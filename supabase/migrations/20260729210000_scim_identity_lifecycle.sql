begin;

create table if not exists private.scim_identities (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null default 'entra' check (
    provider_key in ('entra', 'saml')
  ),
  external_id text not null,
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id),
  auth_user_id uuid not null references auth.users(id),
  email extensions.citext not null,
  display_name text not null,
  active boolean not null,
  roles text[] not null,
  provisioning_version bigint not null default 1 check (
    provisioning_version > 0
  ),
  last_correlation_id uuid not null,
  last_provisioned_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (provider_key, external_id),
  unique (tenant_id, auth_user_id)
);

create table if not exists private.scim_provisioning_events (
  id uuid primary key default gen_random_uuid(),
  scim_identity_id uuid not null references private.scim_identities(id),
  tenant_id text not null,
  auth_user_id uuid not null references auth.users(id),
  action text not null check (
    action in ('created', 'updated', 'deactivated', 'reactivated')
  ),
  previous_state jsonb,
  resulting_state jsonb not null,
  correlation_id uuid not null unique,
  occurred_at timestamptz not null default now()
);

revoke all on table private.scim_identities
  from public, anon, authenticated;
revoke all on table private.scim_provisioning_events
  from public, anon, authenticated;
grant select, insert, update on table private.scim_identities to service_role;
grant select, insert on table private.scim_provisioning_events to service_role;
alter table private.scim_identities enable row level security;
alter table private.scim_provisioning_events enable row level security;

create or replace function private.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select users.id
  from auth.users as users
  where lower(users.email) = lower(trim(p_email))
  order by users.created_at
  limit 1;
$$;

revoke all on function private.find_auth_user_id_by_email(text)
  from public, anon, authenticated;
grant execute on function private.find_auth_user_id_by_email(text)
  to service_role;

create or replace function private.apply_scim_identity(
  p_provider_key text,
  p_external_id text,
  p_tenant_id text,
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_active boolean,
  p_roles text[],
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed_roles constant text[] := array[
    'requester',
    'department_manager',
    'it_reviewer',
    'purchasing_specialist',
    'purchasing_manager',
    'finance_reviewer',
    'compliance_reviewer',
    'receiving_clerk',
    'accounts_payable',
    'executive',
    'auditor',
    'supplier_user',
    'contract_manager',
    'security_reviewer',
    'operations_manager',
    'system_administrator'
  ];
  v_existing private.scim_identities%rowtype;
  v_result private.scim_identities%rowtype;
  v_action text;
begin
  if p_provider_key not in ('entra', 'saml') then
    raise exception 'SCIM_PROVIDER_INVALID';
  end if;
  if not exists (
    select 1
    from public.tenant_demo_configs
    where tenant_id = p_tenant_id
  ) then
    raise exception 'SCIM_TENANT_INVALID';
  end if;
  if not exists (
    select 1
    from auth.users
    where id = p_auth_user_id
      and lower(email) = lower(trim(p_email))
  ) then
    raise exception 'SCIM_AUTH_USER_MISMATCH';
  end if;
  if
    coalesce(array_length(p_roles, 1), 0) = 0
    or exists (
      select 1
      from unnest(p_roles) as requested(role)
      where not (requested.role = any(v_allowed_roles))
    )
  then
    raise exception 'SCIM_ROLE_INVALID';
  end if;

  select *
    into v_existing
    from private.scim_identities
    where provider_key = p_provider_key
      and external_id = p_external_id
    for update;

  insert into private.scim_identities (
    provider_key,
    external_id,
    tenant_id,
    auth_user_id,
    email,
    display_name,
    active,
    roles,
    provisioning_version,
    last_correlation_id,
    last_provisioned_at,
    deactivated_at
  )
  values (
    p_provider_key,
    p_external_id,
    p_tenant_id,
    p_auth_user_id,
    lower(trim(p_email)),
    trim(p_display_name),
    p_active,
    array(select distinct unnest(p_roles) order by 1),
    coalesce(v_existing.provisioning_version, 0) + 1,
    p_correlation_id,
    now(),
    case when p_active then null else now() end
  )
  on conflict (provider_key, external_id) do update
  set
    tenant_id = excluded.tenant_id,
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    display_name = excluded.display_name,
    active = excluded.active,
    roles = excluded.roles,
    provisioning_version =
      private.scim_identities.provisioning_version + 1,
    last_correlation_id = excluded.last_correlation_id,
    last_provisioned_at = now(),
    deactivated_at = excluded.deactivated_at
  returning * into v_result;

  if p_active then
    insert into public.tenant_assignments (
      user_id,
      tenant_id,
      role
    )
    values (p_auth_user_id, p_tenant_id, 'viewer')
    on conflict (user_id, tenant_id) do update set role = 'viewer';

    update public.tenant_role_assignments
    set
      suspended_at = now(),
      suspended_reason = 'Removed by SCIM role synchronization'
    where user_id = p_auth_user_id
      and tenant_id = p_tenant_id
      and assignment_type <> 'presenter_simulation'
      and not (role = any(p_roles))
      and suspended_at is null;

    insert into public.tenant_role_assignments (
      tenant_id,
      user_id,
      role,
      assignment_type,
      starts_at,
      approved_at,
      last_reviewed_at,
      suspended_at,
      suspended_reason
    )
    select
      p_tenant_id,
      p_auth_user_id,
      requested.role,
      'direct',
      now(),
      now(),
      now(),
      null,
      null
    from unnest(p_roles) as requested(role)
    on conflict (tenant_id, user_id, role) do update
    set
      assignment_type = 'direct',
      starts_at = least(
        public.tenant_role_assignments.starts_at,
        excluded.starts_at
      ),
      last_reviewed_at = now(),
      suspended_at = null,
      suspended_reason = null;
  else
    delete from public.tenant_assignments
    where user_id = p_auth_user_id
      and tenant_id = p_tenant_id;
    update public.tenant_role_assignments
    set
      suspended_at = coalesce(suspended_at, now()),
      suspended_reason = 'Identity deactivated by SCIM'
    where user_id = p_auth_user_id
      and tenant_id = p_tenant_id
      and assignment_type <> 'presenter_simulation';
  end if;

  v_action := case
    when v_existing.id is null and p_active then 'created'
    when v_existing.active and not p_active then 'deactivated'
    when not coalesce(v_existing.active, false) and p_active then 'reactivated'
    else 'updated'
  end;

  insert into private.scim_provisioning_events (
    scim_identity_id,
    tenant_id,
    auth_user_id,
    action,
    previous_state,
    resulting_state,
    correlation_id
  )
  values (
    v_result.id,
    p_tenant_id,
    p_auth_user_id,
    v_action,
    case when v_existing.id is null then null else to_jsonb(v_existing) end,
    to_jsonb(v_result),
    p_correlation_id
  );

  return to_jsonb(v_result);
end;
$$;

revoke all on function private.apply_scim_identity(
  text, text, text, uuid, text, text, boolean, text[], uuid
) from public, anon, authenticated;
grant execute on function private.apply_scim_identity(
  text, text, text, uuid, text, text, boolean, text[], uuid
) to service_role;

create or replace function private.prevent_scim_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'SCIM_EVENT_IS_APPEND_ONLY';
end;
$$;

revoke all on function private.prevent_scim_event_mutation()
  from public, anon, authenticated;

drop trigger if exists scim_provisioning_events_append_only
  on private.scim_provisioning_events;
create trigger scim_provisioning_events_append_only
before update or delete on private.scim_provisioning_events
for each row execute function private.prevent_scim_event_mutation();

commit;
