begin;

create table if not exists private.procurement_command_rejections (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete restrict,
  command_id uuid not null,
  correlation_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null,
  active_role text,
  command_type text not null,
  expected_revision bigint not null check (expected_revision >= 0),
  observed_revision bigint not null check (observed_revision >= 0),
  rationale text not null check (length(trim(rationale)) >= 10),
  reason_code text not null check (
    reason_code ~ '^[A-Z][A-Z0-9_]{2,119}$'
  ),
  request_sha256 text not null check (
    request_sha256 ~ '^[0-9a-f]{64}$'
  ),
  requested_at timestamptz not null,
  rejected_at timestamptz not null default now(),
  unique (tenant_id, correlation_id)
);

create index if not exists procurement_command_rejections_command_idx
  on private.procurement_command_rejections (tenant_id, command_id);
create index if not exists procurement_command_rejections_actor_idx
  on private.procurement_command_rejections (
    tenant_id,
    actor_id,
    rejected_at desc
  );

alter table private.procurement_command_rejections enable row level security;
revoke all on table private.procurement_command_rejections
  from public, anon, authenticated;
grant select, insert on table private.procurement_command_rejections
  to service_role;

create or replace function public.record_procurement_command_rejection(
  p_tenant_id text,
  p_command_id uuid,
  p_correlation_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_active_role text,
  p_command_type text,
  p_expected_revision bigint,
  p_rationale text,
  p_reason_code text,
  p_request_sha256 text,
  p_requested_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing private.procurement_command_rejections%rowtype;
  v_rejection private.procurement_command_rejections%rowtype;
  v_observed_revision bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'COMMAND_REJECTION_SERVICE_ROLE_REQUIRED';
  end if;
  if length(trim(p_rationale)) < 10 then
    raise exception 'COMMAND_REJECTION_RATIONALE_REQUIRED';
  end if;
  if p_reason_code !~ '^[A-Z][A-Z0-9_]{2,119}$' then
    raise exception 'COMMAND_REJECTION_CODE_INVALID';
  end if;
  if p_request_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'COMMAND_REJECTION_FINGERPRINT_INVALID';
  end if;

  select *
  into v_existing
  from private.procurement_command_rejections
  where tenant_id = p_tenant_id
    and correlation_id = p_correlation_id
  for update;
  if found then
    if
      v_existing.request_sha256 <> p_request_sha256
      or v_existing.command_id <> p_command_id
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'correlationId', v_existing.correlation_id,
      'observedRevision', v_existing.observed_revision,
      'rejectedAt', v_existing.rejected_at,
      'replayed', true
    );
  end if;

  select revision
  into v_observed_revision
  from public.procurement_demo_snapshots
  where tenant_id = p_tenant_id;
  if not found then
    raise exception 'TRANSACTION_STATE_NOT_INITIALIZED';
  end if;

  insert into private.procurement_command_rejections (
    tenant_id, command_id, correlation_id, actor_id, actor_role, active_role,
    command_type, expected_revision, observed_revision, rationale,
    reason_code, request_sha256, requested_at
  )
  values (
    p_tenant_id, p_command_id, p_correlation_id, p_actor_id,
    trim(p_actor_role), nullif(trim(p_active_role), ''), trim(p_command_type),
    p_expected_revision, v_observed_revision, trim(p_rationale),
    p_reason_code, p_request_sha256, p_requested_at
  )
  returning * into v_rejection;

  return jsonb_build_object(
    'id', v_rejection.id,
    'correlationId', v_rejection.correlation_id,
    'observedRevision', v_rejection.observed_revision,
    'rejectedAt', v_rejection.rejected_at,
    'replayed', false
  );
end;
$$;

create or replace function private.prevent_command_rejection_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'COMMAND_REJECTION_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists procurement_command_rejections_append_only
  on private.procurement_command_rejections;
create trigger procurement_command_rejections_append_only
before update or delete on private.procurement_command_rejections
for each row execute function private.prevent_command_rejection_mutation();

revoke all on function public.record_procurement_command_rejection(
  text, uuid, uuid, uuid, text, text, text, bigint, text, text, text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.record_procurement_command_rejection(
  text, uuid, uuid, uuid, text, text, text, bigint, text, text, text,
  timestamptz
) to service_role;
revoke all on function private.prevent_command_rejection_mutation()
  from public, anon, authenticated;

commit;
