begin;

create table if not exists private.operations_probe_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (length(trim(source)) between 3 and 120),
  correlation_id uuid not null unique,
  environment_kind text not null check (
    environment_kind in ('development_preview', 'sales_demo', 'secure_pilot')
  ),
  release_commit text not null check (
    release_commit = 'unknown'
    or release_commit ~ '^[0-9a-f]{40}$'
  ),
  status text not null check (status in ('passed', 'failed')),
  latency_ms integer not null check (latency_ms >= 0),
  authoritative_readiness boolean not null,
  exact_artifact_agreement boolean not null,
  result_sha256 text not null check (result_sha256 ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  completed_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index if not exists operations_probe_runs_window_idx
  on private.operations_probe_runs (completed_at, release_commit, status);

alter table private.operations_probe_runs enable row level security;
revoke all on table private.operations_probe_runs
  from public, anon, authenticated;
grant select, insert on table private.operations_probe_runs to service_role;

create or replace function private.prevent_operations_probe_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'OPERATIONS_PROBE_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists operations_probe_runs_append_only
  on private.operations_probe_runs;
create trigger operations_probe_runs_append_only
before update or delete on private.operations_probe_runs
for each row execute function private.prevent_operations_probe_mutation();

revoke all on function private.prevent_operations_probe_mutation()
  from public, anon, authenticated;

commit;
