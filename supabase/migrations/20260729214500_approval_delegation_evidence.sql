begin;

create table if not exists public.procurement_approval_delegation_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  delegation_key text not null,
  approval_key text not null,
  delegator_user_key text not null,
  delegator_role text not null,
  delegate_role text not null,
  delegation_type text not null
    check (delegation_type in ('manual', 'out_of_office')),
  starts_on date not null,
  expires_on date not null check (expires_on > starts_on),
  status text not null check (status in ('active', 'revoked', 'expired')),
  reason text not null check (length(reason) >= 20),
  source_revision bigint not null check (source_revision >= 0),
  command_id uuid,
  recorded_at timestamptz not null default now(),
  unique (tenant_id, delegation_key, source_revision),
  foreign key (tenant_id, command_id)
    references public.procurement_command_ledger(tenant_id, command_id)
    on delete restrict
    deferrable initially deferred
);

create index if not exists procurement_approval_delegation_current_idx
  on public.procurement_approval_delegation_versions
    (tenant_id, approval_key, source_revision desc);

create or replace function private.project_approval_delegations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.procurement_approval_delegation_versions (
    tenant_id,
    delegation_key,
    approval_key,
    delegator_user_key,
    delegator_role,
    delegate_role,
    delegation_type,
    starts_on,
    expires_on,
    status,
    reason,
    source_revision,
    command_id
  )
  select
    new.tenant_id,
    delegation ->> 'id',
    delegation ->> 'approvalId',
    delegation ->> 'delegatorUserId',
    delegation ->> 'delegatorRole',
    delegation ->> 'delegateRole',
    delegation ->> 'delegationType',
    (delegation ->> 'startsOn')::date,
    (delegation ->> 'expiresOn')::date,
    delegation ->> 'status',
    delegation ->> 'reason',
    new.revision,
    new.last_command_id
  from jsonb_array_elements(
    coalesce(new.state -> 'approvalDelegations', '[]'::jsonb)
  ) as delegation
  on conflict (tenant_id, delegation_key, source_revision) do nothing;

  return new;
end;
$$;

drop trigger if exists procurement_approval_delegation_projection
  on public.procurement_demo_snapshots;
create trigger procurement_approval_delegation_projection
after insert or update on public.procurement_demo_snapshots
for each row execute function private.project_approval_delegations();

insert into public.procurement_approval_delegation_versions (
  tenant_id,
  delegation_key,
  approval_key,
  delegator_user_key,
  delegator_role,
  delegate_role,
  delegation_type,
  starts_on,
  expires_on,
  status,
  reason,
  source_revision,
  command_id
)
select
  snapshot.tenant_id,
  delegation ->> 'id',
  delegation ->> 'approvalId',
  delegation ->> 'delegatorUserId',
  delegation ->> 'delegatorRole',
  delegation ->> 'delegateRole',
  delegation ->> 'delegationType',
  (delegation ->> 'startsOn')::date,
  (delegation ->> 'expiresOn')::date,
  delegation ->> 'status',
  delegation ->> 'reason',
  snapshot.revision,
  snapshot.last_command_id
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'approvalDelegations', '[]'::jsonb)
) as delegation
on conflict (tenant_id, delegation_key, source_revision) do nothing;

alter table public.procurement_approval_delegation_versions
  enable row level security;
revoke all on table public.procurement_approval_delegation_versions
  from anon, authenticated;
grant select on table public.procurement_approval_delegation_versions
  to authenticated;
grant all on table public.procurement_approval_delegation_versions
  to service_role;

create policy tenant_member_read
on public.procurement_approval_delegation_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id =
        procurement_approval_delegation_versions.tenant_id
  )
);

revoke all on function private.project_approval_delegations()
  from public, anon, authenticated;
grant execute on function private.project_approval_delegations()
  to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
