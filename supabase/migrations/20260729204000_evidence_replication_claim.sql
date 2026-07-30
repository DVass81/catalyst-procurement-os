begin;

create or replace function private.claim_evidence_replication_job()
returns table (
  id uuid,
  tenant_id text,
  package_id uuid,
  artifact_type text,
  source_bucket text,
  source_path text,
  sha256 text,
  retention_until timestamptz,
  object_lock_mode text,
  attempts integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  with candidate as (
    select outbox.id
    from private.evidence_replication_outbox as outbox
    where outbox.status in ('pending', 'retry')
      and outbox.available_at <= now()
    order by outbox.created_at, outbox.id
    for update skip locked
    limit 1
  ),
  claimed as (
    update private.evidence_replication_outbox as outbox
    set
      status = 'processing',
      attempts = outbox.attempts + 1,
      updated_at = now()
    from candidate
    where outbox.id = candidate.id
    returning
      outbox.id,
      outbox.tenant_id,
      outbox.package_id,
      outbox.artifact_type,
      outbox.source_bucket,
      outbox.source_path,
      outbox.sha256,
      outbox.retention_until,
      outbox.object_lock_mode,
      outbox.attempts
  )
  select * from claimed;
$$;

revoke all on function private.claim_evidence_replication_job()
  from public, anon, authenticated;
grant execute on function private.claim_evidence_replication_job()
  to service_role;

commit;
