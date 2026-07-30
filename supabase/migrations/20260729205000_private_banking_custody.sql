begin;

-- Full banking values never enter an exposed schema. Each version contains
-- only application-layer ciphertext and the KMS-wrapped data key required to
-- decrypt it inside a separately authorized server process.
create table if not exists private.supplier_banking_envelopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete restrict,
  supplier_organization_id text not null,
  version integer not null check (version > 0),
  algorithm text not null check (algorithm = 'AES-256-GCM'),
  ciphertext text not null,
  encrypted_data_key text not null,
  initialization_vector text not null,
  authentication_tag text not null,
  kms_key_id text not null,
  encryption_context jsonb not null,
  account_last_four text not null check (account_last_four ~ '^[0-9]{4}$'),
  routing_last_four text not null check (routing_last_four ~ '^[0-9]{4}$'),
  submitted_by uuid not null references auth.users(id),
  source_command_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, supplier_organization_id, version),
  unique (tenant_id, source_command_id),
  foreign key (tenant_id, source_command_id)
    references public.procurement_command_ledger(tenant_id, command_id)
    on delete restrict,
  check (
    encryption_context ->> 'catalystTenant' = tenant_id
    and encryption_context ->> 'catalystPurpose' = 'supplier-banking'
  )
);

create table if not exists private.supplier_banking_control_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete restrict,
  banking_envelope_id uuid not null
    references private.supplier_banking_envelopes(id),
  action text not null check (
    action in (
      'submitted',
      'out_of_band_verified',
      'approved',
      'rejected',
      'superseded'
    )
  ),
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  rationale text not null check (length(trim(rationale)) >= 20),
  correlation_id uuid not null,
  evidence_reference text not null,
  source_command_id uuid not null,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, correlation_id, action),
  unique (tenant_id, source_command_id, action),
  foreign key (tenant_id, source_command_id)
    references public.procurement_command_ledger(tenant_id, command_id)
    on delete restrict
);

create index if not exists supplier_banking_envelopes_supplier_idx
  on private.supplier_banking_envelopes (
    tenant_id,
    supplier_organization_id,
    version desc
  );
create index if not exists supplier_banking_control_events_envelope_idx
  on private.supplier_banking_control_events (
    banking_envelope_id,
    occurred_at
  );

revoke all on table private.supplier_banking_envelopes
  from public, anon, authenticated;
revoke all on table private.supplier_banking_control_events
  from public, anon, authenticated;
grant select, insert on table private.supplier_banking_envelopes
  to service_role;
grant select, insert on table private.supplier_banking_control_events
  to service_role;

alter table private.supplier_banking_envelopes enable row level security;
alter table private.supplier_banking_control_events enable row level security;

create or replace function private.enforce_banking_dual_control()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_envelope private.supplier_banking_envelopes%rowtype;
  v_verifier uuid;
begin
  select *
    into v_envelope
    from private.supplier_banking_envelopes
    where id = new.banking_envelope_id;
  if not found or v_envelope.tenant_id <> new.tenant_id then
    raise exception 'BANKING_ENVELOPE_TENANT_MISMATCH';
  end if;

  if new.action = 'out_of_band_verified' then
    if new.actor_id = v_envelope.submitted_by then
      raise exception 'BANKING_SUBMITTER_CANNOT_VERIFY';
    end if;
    if exists (
      select 1
      from private.supplier_banking_control_events as event
      where event.banking_envelope_id = new.banking_envelope_id
        and event.action in ('out_of_band_verified', 'approved', 'rejected')
    ) then
      raise exception 'BANKING_VERIFICATION_ALREADY_DECIDED';
    end if;
  end if;

  if new.action = 'approved' then
    select event.actor_id
      into v_verifier
      from private.supplier_banking_control_events as event
      where event.banking_envelope_id = new.banking_envelope_id
        and event.action = 'out_of_band_verified'
      order by event.occurred_at desc
      limit 1;
    if v_verifier is null then
      raise exception 'BANKING_OUT_OF_BAND_VERIFICATION_REQUIRED';
    end if;
    if new.actor_id in (v_envelope.submitted_by, v_verifier) then
      raise exception 'BANKING_DUAL_CONTROL_REQUIRED';
    end if;
    if exists (
      select 1
      from private.supplier_banking_control_events as event
      where event.banking_envelope_id = new.banking_envelope_id
        and event.action in ('approved', 'rejected')
    ) then
      raise exception 'BANKING_APPROVAL_ALREADY_DECIDED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_banking_dual_control()
  from public, anon, authenticated;

drop trigger if exists enforce_banking_dual_control
  on private.supplier_banking_control_events;
create trigger enforce_banking_dual_control
before insert on private.supplier_banking_control_events
for each row
execute function private.enforce_banking_dual_control();

create or replace function private.prevent_banking_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'BANKING_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

revoke all on function private.prevent_banking_evidence_mutation()
  from public, anon, authenticated;

drop trigger if exists supplier_banking_envelopes_append_only
  on private.supplier_banking_envelopes;
create trigger supplier_banking_envelopes_append_only
before update or delete on private.supplier_banking_envelopes
for each row
execute function private.prevent_banking_evidence_mutation();

drop trigger if exists supplier_banking_control_events_append_only
  on private.supplier_banking_control_events;
create trigger supplier_banking_control_events_append_only
before update or delete on private.supplier_banking_control_events
for each row
execute function private.prevent_banking_evidence_mutation();

commit;
