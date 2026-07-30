begin;

create table if not exists public.identity_domain_mappings (
  domain extensions.citext primary key,
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  provider_key text not null check (provider_key in ('entra', 'saml')),
  default_role text not null default 'requester' check (
    default_role in (
      'requester', 'department_manager', 'it_reviewer',
      'purchasing_specialist', 'purchasing_manager', 'finance_reviewer',
      'compliance_reviewer', 'receiving_clerk', 'accounts_payable',
      'executive', 'auditor', 'contract_manager', 'security_reviewer',
      'operations_manager', 'system_administrator'
    )
  ),
  status text not null default 'validation_required' check (
    status in ('validation_required', 'active', 'suspended')
  ),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  check (
    status <> 'active'
    or (approved_by is not null and approved_at is not null)
  )
);

create table if not exists private.jit_identity_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email extensions.citext not null,
  domain extensions.citext not null,
  provider_key text not null check (provider_key in ('entra', 'saml')),
  requested_role text not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  decision_rationale text,
  last_correlation_id uuid not null,
  version integer not null default 1 check (version > 0),
  unique (tenant_id, auth_user_id),
  check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or
    (
      status in ('approved', 'rejected', 'cancelled')
      and decided_at is not null
      and decided_by is not null
      and length(trim(decision_rationale)) >= 20
    )
  )
);

create table if not exists private.jit_identity_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references private.jit_identity_requests(id) on delete restrict,
  tenant_id text not null,
  auth_user_id uuid not null references auth.users(id),
  action text not null check (
    action in ('requested', 'approved', 'rejected', 'cancelled')
  ),
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  rationale text not null check (length(trim(rationale)) >= 20),
  correlation_id uuid not null unique,
  occurred_at timestamptz not null default now()
);

alter table public.identity_domain_mappings enable row level security;
alter table private.jit_identity_requests enable row level security;
alter table private.jit_identity_events enable row level security;
revoke all on table public.identity_domain_mappings
  from public, anon, authenticated;
revoke all on table private.jit_identity_requests
  from public, anon, authenticated;
revoke all on table private.jit_identity_events
  from public, anon, authenticated;
grant select, insert, update on table public.identity_domain_mappings
  to service_role;
grant select, insert, update on table private.jit_identity_requests
  to service_role;
grant select, insert on table private.jit_identity_events
  to service_role;

create or replace function public.record_jit_identity_request(
  p_auth_user_id uuid,
  p_email text,
  p_provider_key text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_domain extensions.citext;
  v_mapping public.identity_domain_mappings%rowtype;
  v_existing private.jit_identity_requests%rowtype;
  v_request private.jit_identity_requests%rowtype;
begin
  if p_provider_key not in ('entra', 'saml') then
    raise exception 'JIT_PROVIDER_INVALID';
  end if;
  if not exists (
    select 1 from auth.users
    where id = p_auth_user_id
      and lower(email) = lower(trim(p_email))
  ) then
    raise exception 'JIT_AUTH_USER_MISMATCH';
  end if;
  v_domain := split_part(lower(trim(p_email)), '@', 2);
  select *
  into v_mapping
  from public.identity_domain_mappings
  where domain = v_domain
    and provider_key = p_provider_key
    and status = 'active';
  if not found then
    raise exception 'JIT_DOMAIN_NOT_MAPPED';
  end if;

  select *
  into v_existing
  from private.jit_identity_requests
  where tenant_id = v_mapping.tenant_id
    and auth_user_id = p_auth_user_id
  for update;
  if v_existing.status = 'rejected' then
    raise exception 'JIT_REQUEST_REJECTED';
  end if;

  insert into private.jit_identity_requests (
    tenant_id, auth_user_id, email, domain, provider_key, requested_role,
    status, requested_at, last_correlation_id, version
  )
  values (
    v_mapping.tenant_id, p_auth_user_id, lower(trim(p_email)), v_domain,
    p_provider_key, v_mapping.default_role, 'pending', now(),
    p_correlation_id, 1
  )
  on conflict (tenant_id, auth_user_id) do update
  set requested_at = case
        when private.jit_identity_requests.status = 'pending'
          then now()
        else private.jit_identity_requests.requested_at
      end,
      last_correlation_id = excluded.last_correlation_id,
      version = private.jit_identity_requests.version + 1
  returning * into v_request;

  insert into private.jit_identity_events (
    request_id, tenant_id, auth_user_id, action, actor_id, actor_role,
    rationale, correlation_id
  )
  values (
    v_request.id, v_request.tenant_id, p_auth_user_id, 'requested',
    p_auth_user_id, 'federated_identity',
    'Verified federated identity requested governed just-in-time access.',
    p_correlation_id
  );

  return jsonb_build_object(
    'id', v_request.id,
    'tenantId', v_request.tenant_id,
    'status', v_request.status,
    'requestedRole', v_request.requested_role,
    'version', v_request.version
  );
end;
$$;

create or replace function public.decide_jit_identity_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_rationale text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request private.jit_identity_requests%rowtype;
  v_status text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'JIT_DECISION_INVALID';
  end if;
  if length(trim(p_rationale)) < 20 then
    raise exception 'JIT_RATIONALE_REQUIRED';
  end if;

  select *
  into v_request
  from private.jit_identity_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'JIT_REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then
    raise exception 'JIT_REQUEST_ALREADY_DECIDED';
  end if;
  if not exists (
    select 1
    from public.tenant_role_assignments as assignment
    where assignment.tenant_id = v_request.tenant_id
      and assignment.user_id = p_actor_id
      and assignment.role = 'system_administrator'
      and assignment.suspended_at is null
      and assignment.starts_at <= now()
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
  ) then
    raise exception 'JIT_ADMIN_AUTHORITY_REQUIRED';
  end if;
  if p_actor_id = v_request.auth_user_id then
    raise exception 'JIT_SELF_APPROVAL_DENIED';
  end if;

  v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  update private.jit_identity_requests
  set status = v_status,
      decided_at = now(),
      decided_by = p_actor_id,
      decision_rationale = trim(p_rationale),
      last_correlation_id = p_correlation_id,
      version = version + 1
  where id = p_request_id
  returning * into v_request;

  if p_decision = 'approve' then
    insert into public.tenant_assignments (user_id, tenant_id, role)
    values (v_request.auth_user_id, v_request.tenant_id, 'viewer')
    on conflict (user_id, tenant_id) do update set role = 'viewer';

    insert into public.tenant_role_assignments (
      tenant_id, user_id, role, assignment_type, starts_at, approved_by,
      approved_at, last_reviewed_at
    )
    values (
      v_request.tenant_id, v_request.auth_user_id, v_request.requested_role,
      'direct', now(), p_actor_id, now(), now()
    )
    on conflict (tenant_id, user_id, role) do update
    set assignment_type = 'direct',
        starts_at = now(),
        approved_by = p_actor_id,
        approved_at = now(),
        last_reviewed_at = now(),
        suspended_at = null,
        suspended_reason = null;
  end if;

  insert into private.jit_identity_events (
    request_id, tenant_id, auth_user_id, action, actor_id, actor_role,
    rationale, correlation_id
  )
  values (
    v_request.id, v_request.tenant_id, v_request.auth_user_id,
    v_status, p_actor_id, 'system_administrator', trim(p_rationale),
    p_correlation_id
  );

  return jsonb_build_object(
    'id', v_request.id,
    'tenantId', v_request.tenant_id,
    'status', v_request.status,
    'requestedRole', v_request.requested_role,
    'version', v_request.version
  );
end;
$$;

create or replace function private.prevent_jit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'JIT_EVENT_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists jit_identity_events_append_only
  on private.jit_identity_events;
create trigger jit_identity_events_append_only
before update or delete on private.jit_identity_events
for each row execute function private.prevent_jit_event_mutation();

revoke all on function public.record_jit_identity_request(
  uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_jit_identity_request(
  uuid, text, text, uuid
) to service_role;
revoke all on function public.decide_jit_identity_request(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.decide_jit_identity_request(
  uuid, uuid, text, text, uuid
) to service_role;
revoke all on function private.prevent_jit_event_mutation()
  from public, anon, authenticated;

commit;
