begin;

-- A release is not authoritative merely because the snapshot and normalized
-- row counts agree. Recompute every workflow-event hash and link so application
-- readiness fails closed when immutable evidence is missing or altered.
create or replace function public.procurement_audit_chain_readiness(
  p_tenant_id text
)
returns table (
  ready boolean,
  event_count integer,
  latest_revision bigint,
  first_broken_revision bigint,
  mismatch_reasons text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ordered as (
    select
      event.state_revision,
      event.previous_event_hash,
      event.event_hash,
      lag(event.event_hash) over (
        order by event.state_revision
      ) as expected_previous_hash,
      encode(
        extensions.digest(
          concat_ws(
            '|',
            event.tenant_id,
            event.command_id::text,
            event.command_type,
            event.command_payload::text,
            event.actor_id::text,
            event.actor_role,
            event.state_revision::text,
            event.state_checksum,
            coalesce(event.previous_event_hash, '')
          ),
          'sha256'
        ),
        'hex'
      ) as calculated_event_hash
    from public.procurement_workflow_events as event
    where event.tenant_id = p_tenant_id
  ),
  summarized as (
    select
      count(*)::integer as event_count,
      coalesce(max(state_revision), 0) as latest_revision,
      coalesce(
        bool_and(
          previous_event_hash is not distinct from expected_previous_hash
        ),
        true
      ) as links_valid,
      coalesce(bool_and(event_hash = calculated_event_hash), true)
        as hashes_valid,
      count(*)::bigint = coalesce(max(state_revision), 0)
        as revisions_complete,
      min(state_revision) filter (
        where
          previous_event_hash is distinct from expected_previous_hash
          or event_hash <> calculated_event_hash
      ) as first_broken_revision
    from ordered
  )
  select
    summarized.links_valid
      and summarized.hashes_valid
      and summarized.revisions_complete,
    summarized.event_count,
    summarized.latest_revision,
    summarized.first_broken_revision,
    array_remove(
      array[
        case when not summarized.links_valid
          then 'audit_previous_hash_mismatch' end,
        case when not summarized.hashes_valid
          then 'audit_event_hash_mismatch' end,
        case when not summarized.revisions_complete
          then 'audit_revision_gap' end
      ]::text[],
      null
    )
  from summarized;
$$;

revoke all on function public.procurement_audit_chain_readiness(text)
  from public, anon, authenticated;
grant execute on function public.procurement_audit_chain_readiness(text)
  to service_role;

-- Preserve the last complete demonstration session before a reset or a
-- presenter jump back to Request. The table is intentionally outside exposed
-- schemas and is append-only.
create table if not exists private.procurement_demo_session_archives (
  tenant_id text not null,
  revision bigint not null check (revision >= 0),
  state jsonb not null,
  state_checksum text not null check (state_checksum ~ '^[0-9a-f]{64}$'),
  last_command_id uuid,
  superseded_by_command_id uuid not null,
  updated_by uuid,
  source_updated_at timestamptz not null,
  archived_at timestamptz not null default now(),
  primary key (tenant_id, revision)
);

revoke all on table private.procurement_demo_session_archives
  from public, anon, authenticated;
grant select, insert on table private.procurement_demo_session_archives
  to service_role;
alter table private.procurement_demo_session_archives
  enable row level security;

create or replace function private.archive_demo_session_before_reset()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if
    coalesce(new.state ->> 'stage', '') = 'draft'
    and coalesce(old.state ->> 'stage', '') <> 'draft'
  then
    insert into private.procurement_demo_session_archives (
      tenant_id,
      revision,
      state,
      state_checksum,
      last_command_id,
      superseded_by_command_id,
      updated_by,
      source_updated_at
    )
    values (
      old.tenant_id,
      old.revision,
      old.state,
      old.state_checksum,
      old.last_command_id,
      new.last_command_id,
      old.updated_by,
      old.updated_at
    )
    on conflict (tenant_id, revision) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.archive_demo_session_before_reset()
  from public, anon, authenticated;
grant execute on function private.archive_demo_session_before_reset()
  to service_role;

drop trigger if exists archive_demo_session_before_reset
  on public.procurement_demo_snapshots;
create trigger archive_demo_session_before_reset
before update on public.procurement_demo_snapshots
for each row
execute function private.archive_demo_session_before_reset();

create or replace function private.prevent_demo_session_archive_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'DEMO_SESSION_ARCHIVE_IS_APPEND_ONLY';
end;
$$;

revoke all on function private.prevent_demo_session_archive_mutation()
  from public, anon, authenticated;

drop trigger if exists demo_session_archive_append_only
  on private.procurement_demo_session_archives;
create trigger demo_session_archive_append_only
before update or delete on private.procurement_demo_session_archives
for each row
execute function private.prevent_demo_session_archive_mutation();

-- This durable outbox is the database half of the S3 Object Lock replication
-- contract. A release cannot claim immutable external retention until a worker
-- records the version ID, retention timestamp, checksum verification, and
-- successful replication for every row.
create table if not exists private.evidence_replication_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  package_id uuid not null references public.audit_packages(id),
  artifact_type text not null check (
    artifact_type in ('pdf', 'csv', 'json')
  ),
  source_bucket text not null default 'procurement-evidence',
  source_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  retention_until timestamptz not null,
  object_lock_mode text not null default 'COMPLIANCE' check (
    object_lock_mode in ('COMPLIANCE', 'GOVERNANCE')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'replicated', 'retry', 'dead_letter')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  destination_bucket text,
  destination_key text,
  destination_version_id text,
  verified_sha256 text check (
    verified_sha256 is null or verified_sha256 ~ '^[0-9a-f]{64}$'
  ),
  replicated_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, artifact_type)
);

create index if not exists evidence_replication_outbox_pending_idx
  on private.evidence_replication_outbox (status, available_at)
  where status in ('pending', 'retry');

revoke all on table private.evidence_replication_outbox
  from public, anon, authenticated;
grant select, insert, update on table private.evidence_replication_outbox
  to service_role;
alter table private.evidence_replication_outbox enable row level security;

create or replace function private.queue_audit_package_replication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_retention_until timestamptz;
begin
  if new.lifecycle_state <> 'completed' then
    return new;
  end if;

  v_retention_until := coalesce(
    new.expires_at,
    new.completed_at,
    new.as_of
  ) + interval '7 years';

  insert into private.evidence_replication_outbox (
    tenant_id,
    package_id,
    artifact_type,
    source_path,
    sha256,
    retention_until
  )
  values
    (
      new.tenant_id,
      new.id,
      'pdf',
      new.pdf_storage_path,
      new.manifest #>> '{artifacts,pdf,sha256}',
      v_retention_until
    ),
    (
      new.tenant_id,
      new.id,
      'csv',
      new.csv_storage_path,
      new.manifest #>> '{artifacts,csv,sha256}',
      v_retention_until
    ),
    (
      new.tenant_id,
      new.id,
      'json',
      new.json_storage_path,
      new.manifest_sha256,
      v_retention_until
    )
  on conflict (package_id, artifact_type) do nothing;

  return new;
end;
$$;

revoke all on function private.queue_audit_package_replication()
  from public, anon, authenticated;
grant execute on function private.queue_audit_package_replication()
  to service_role;

drop trigger if exists queue_audit_package_replication
  on public.audit_packages;
create trigger queue_audit_package_replication
after insert or update of lifecycle_state on public.audit_packages
for each row
execute function private.queue_audit_package_replication();

-- Backfill already-completed synthetic evidence so qualification can prove the
-- queue is exhaustive before an AWS worker is enabled.
insert into private.evidence_replication_outbox (
  tenant_id,
  package_id,
  artifact_type,
  source_path,
  sha256,
  retention_until
)
select
  package.tenant_id,
  package.id,
  artifact.artifact_type,
  artifact.source_path,
  artifact.sha256,
  coalesce(package.expires_at, package.completed_at, package.as_of)
    + interval '7 years'
from public.audit_packages as package
cross join lateral (
  values
    (
      'pdf'::text,
      package.pdf_storage_path,
      package.manifest #>> '{artifacts,pdf,sha256}'
    ),
    (
      'csv'::text,
      package.csv_storage_path,
      package.manifest #>> '{artifacts,csv,sha256}'
    ),
    (
      'json'::text,
      package.json_storage_path,
      package.manifest_sha256
    )
) as artifact(artifact_type, source_path, sha256)
where package.lifecycle_state = 'completed'
  and artifact.source_path is not null
  and artifact.sha256 ~ '^[0-9a-f]{64}$'
on conflict (package_id, artifact_type) do nothing;

commit;
