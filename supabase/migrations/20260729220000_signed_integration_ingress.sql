begin;

create table if not exists private.integration_ingress_events (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete restrict,
  event_id uuid not null,
  key_id text not null,
  request_sha256 text not null
    check (request_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  entity_type text not null check (
    entity_type in (
      'purchase_request',
      'purchase_order',
      'receipt',
      'invoice',
      'supplier'
    )
  ),
  operation text not null check (operation in ('upsert', 'reverse')),
  expected_revision bigint not null check (expected_revision >= 0),
  correlation_id uuid not null,
  data_classification text not null check (
    data_classification in (
      'synthetic_demo',
      'approved_pilot_procurement'
    )
  ),
  pilot_data_approval_reference text,
  prohibited_data_attestation boolean not null,
  synthetic boolean not null,
  status text not null default 'staged' check (
    status in (
      'staged',
      'validating',
      'ready_for_approval',
      'approved',
      'posted',
      'partially_failed',
      'failed',
      'dead_letter',
      'reconciled',
      'reversed',
      'superseded'
    )
  ),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  check (
    (
      data_classification = 'synthetic_demo'
      and synthetic
      and not prohibited_data_attestation
      and pilot_data_approval_reference is null
    )
    or (
      data_classification = 'approved_pilot_procurement'
      and not synthetic
      and prohibited_data_attestation
      and pilot_data_approval_reference is not null
      and length(trim(pilot_data_approval_reference)) between 8 and 160
    )
  )
);

create index if not exists integration_ingress_status_idx
  on private.integration_ingress_events
    (tenant_id, status, received_at);

revoke all on table private.integration_ingress_events
  from public, anon, authenticated;
grant select, insert, update on table private.integration_ingress_events
  to service_role;
alter table private.integration_ingress_events enable row level security;

create or replace function private.record_integration_ingress(
  p_tenant_id text,
  p_event_id uuid,
  p_key_id text,
  p_request_sha256 text,
  p_payload jsonb
)
returns table (
  event_id uuid,
  status text,
  replayed boolean,
  received_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing private.integration_ingress_events%rowtype;
  v_inserted private.integration_ingress_events%rowtype;
begin
  if p_request_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'INTEGRATION_REQUEST_HASH_INVALID';
  end if;
  if
    p_payload ->> 'tenantId' <> p_tenant_id
    or p_payload ->> 'eventId' <> p_event_id::text
  then
    raise exception 'INTEGRATION_PAYLOAD_IDENTITY_MISMATCH';
  end if;

  select *
  into v_existing
  from private.integration_ingress_events as ingress
  where ingress.tenant_id = p_tenant_id
    and ingress.event_id = p_event_id
  for update;

  if found then
    if
      v_existing.request_sha256 <> p_request_sha256
      or v_existing.key_id <> p_key_id
    then
      raise exception 'INTEGRATION_IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
      select
        v_existing.event_id,
        v_existing.status,
        true,
        v_existing.received_at;
    return;
  end if;

  insert into private.integration_ingress_events (
    tenant_id,
    event_id,
    key_id,
    request_sha256,
    payload,
    entity_type,
    operation,
    expected_revision,
    correlation_id,
    data_classification,
    pilot_data_approval_reference,
    prohibited_data_attestation,
    synthetic
  )
  values (
    p_tenant_id,
    p_event_id,
    p_key_id,
    p_request_sha256,
    p_payload,
    p_payload ->> 'entityType',
    p_payload ->> 'operation',
    (p_payload ->> 'expectedRevision')::bigint,
    (p_payload ->> 'correlationId')::uuid,
    p_payload ->> 'dataClassification',
    nullif(p_payload ->> 'pilotDataApprovalReference', ''),
    (p_payload ->> 'prohibitedDataAttestation')::boolean,
    (p_payload ->> 'synthetic')::boolean
  )
  returning * into v_inserted;

  return query
    select
      v_inserted.event_id,
      v_inserted.status,
      false,
      v_inserted.received_at;
end;
$$;

revoke all on function private.record_integration_ingress(
  text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function private.record_integration_ingress(
  text, uuid, text, text, jsonb
) to service_role;

create or replace function private.prevent_integration_ingress_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'INTEGRATION_INGRESS_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

revoke all on function private.prevent_integration_ingress_delete()
  from public, anon, authenticated;

drop trigger if exists integration_ingress_no_delete
  on private.integration_ingress_events;
create trigger integration_ingress_no_delete
before delete on private.integration_ingress_events
for each row execute function private.prevent_integration_ingress_delete();

commit;
