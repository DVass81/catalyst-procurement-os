begin;

create table if not exists public.phase3_report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  schedule_key text not null,
  report_key text not null,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  export_format text not null check (export_format in ('PDF', 'XLSX', 'CSV')),
  recipient_roles text[] not null check (cardinality(recipient_roles) > 0),
  secure_link_expires_hours integer not null
    check (secure_link_expires_hours between 1 and 168),
  retention_days integer not null check (retention_days between 365 and 2920),
  status text not null check (status in ('active', 'paused')),
  created_by_role text not null,
  next_run_at timestamptz not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, schedule_key)
);

create table if not exists public.phase3_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  delivery_key text not null,
  schedule_key text not null,
  snapshot_key text not null,
  recipient_roles text[] not null check (cardinality(recipient_roles) > 0),
  export_format text not null check (export_format in ('PDF', 'XLSX', 'CSV')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('delivered', 'expired', 'revoked')),
  delivered_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > delivered_at),
  retention_until timestamptz not null check (retention_until > expires_at),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, delivery_key),
  foreign key (tenant_id, schedule_key)
    references public.phase3_report_schedules (tenant_id, schedule_key)
    on delete restrict,
  foreign key (tenant_id, snapshot_key)
    references public.phase3_report_snapshots (tenant_id, snapshot_key)
    on delete restrict
);

create index if not exists phase3_report_schedules_due_idx
  on public.phase3_report_schedules (tenant_id, status, next_run_at);
create index if not exists phase3_report_deliveries_retention_idx
  on public.phase3_report_deliveries (tenant_id, retention_until);

create or replace function private.prevent_report_delivery_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;
  raise exception 'REPORT_DELIVERY_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists phase3_report_deliveries_append_only
  on public.phase3_report_deliveries;
create trigger phase3_report_deliveries_append_only
before update or delete on public.phase3_report_deliveries
for each row execute function private.prevent_report_delivery_mutation();

revoke all on function private.prevent_report_delivery_mutation()
  from public, anon, authenticated;

alter table public.phase3_report_schedules enable row level security;
alter table public.phase3_report_deliveries enable row level security;
revoke all on table public.phase3_report_schedules from anon, authenticated;
revoke all on table public.phase3_report_deliveries from anon, authenticated;
grant select on table public.phase3_report_schedules to authenticated;
grant select on table public.phase3_report_deliveries to authenticated;
grant all on table public.phase3_report_schedules to service_role;
grant all on table public.phase3_report_deliveries to service_role;

create policy tenant_member_read
on public.phase3_report_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = phase3_report_schedules.tenant_id
  )
);

create policy authorized_recipient_read
on public.phase3_report_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_role_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = phase3_report_deliveries.tenant_id
      and assignment.role = any(phase3_report_deliveries.recipient_roles)
      and assignment.suspended_at is null
      and assignment.starts_at <= now()
      and (assignment.expires_at is null or assignment.expires_at > now())
  )
);

grant usage, select on all sequences in schema public to service_role;

commit;
