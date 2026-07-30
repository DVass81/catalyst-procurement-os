begin;

-- Preserve both the coarse account assignment used by the service RPC and the
-- server-derived active operational role used for the command decision.
alter table public.procurement_command_ledger
  add column if not exists active_role text,
  add column if not exists assurance_level text,
  add column if not exists assignment_type text,
  add column if not exists protected_action boolean not null default false,
  add column if not exists simulation boolean not null default false,
  add column if not exists rationale text,
  add column if not exists requested_at timestamptz;

alter table public.procurement_command_ledger
  drop constraint if exists procurement_command_ledger_assurance_check;
alter table public.procurement_command_ledger
  add constraint procurement_command_ledger_assurance_check
  check (
    assurance_level is null
    or assurance_level in ('aal1', 'aal2', 'unknown')
  );

alter table public.procurement_command_ledger
  drop constraint if exists procurement_command_ledger_assignment_type_check;
alter table public.procurement_command_ledger
  add constraint procurement_command_ledger_assignment_type_check
  check (
    assignment_type is null
    or assignment_type in (
      'direct',
      'delegated',
      'emergency',
      'presenter_simulation'
    )
  );

alter table public.procurement_workflow_events
  add column if not exists assurance_level text,
  add column if not exists assignment_type text,
  add column if not exists protected_action boolean not null default false,
  add column if not exists requested_at timestamptz;

alter table public.procurement_workflow_events
  drop constraint if exists procurement_workflow_events_assurance_check;
alter table public.procurement_workflow_events
  add constraint procurement_workflow_events_assurance_check
  check (
    assurance_level is null
    or assurance_level in ('aal1', 'aal2', 'unknown')
  );

create or replace function private.enrich_procurement_command_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_requested_at text;
begin
  new.active_role := coalesce(
    nullif(new.command_payload #>> '{identityAudit,activeRole}', ''),
    nullif(new.command_payload ->> 'activePersona', '')
  );
  new.assurance_level := nullif(
    new.command_payload #>> '{identityAudit,assuranceLevel}',
    ''
  );
  new.assignment_type := nullif(
    new.command_payload #>> '{identityAudit,assignmentType}',
    ''
  );
  new.protected_action := coalesce(
    (new.command_payload #>> '{identityAudit,protectedAction}')::boolean,
    false
  );
  new.simulation := coalesce(
    (new.command_payload #>> '{identityAudit,simulation}')::boolean,
    (new.command_payload ->> 'simulation')::boolean,
    false
  );
  new.rationale := coalesce(
    nullif(new.command_payload ->> 'rationale', ''),
    nullif(new.command_payload ->> 'reason', '')
  );
  v_requested_at := nullif(new.command_payload ->> 'requestedAt', '');

  if
    new.active_role is null
    or new.assurance_level is null
    or new.assignment_type is null
    or new.rationale is null
    or length(trim(new.rationale)) < 10
    or v_requested_at is null
  then
    raise exception 'AUTHORITATIVE_COMMAND_CONTEXT_REQUIRED';
  end if;

  begin
    new.requested_at := v_requested_at::timestamptz;
  exception when others then
    raise exception 'AUTHORITATIVE_COMMAND_TIMESTAMP_INVALID';
  end;
  return new;
end;
$$;

revoke all on function private.enrich_procurement_command_ledger()
  from public, anon, authenticated;

drop trigger if exists enrich_procurement_command_ledger
  on public.procurement_command_ledger;
create trigger enrich_procurement_command_ledger
before insert on public.procurement_command_ledger
for each row
execute function private.enrich_procurement_command_ledger();

-- This function intentionally retains its historical name because an existing
-- trigger calls it for every workflow event, including Phase 2 commands.
create or replace function private.enrich_phase3_workflow_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  requested_correlation text;
  v_requested_at text;
begin
  new.active_persona := coalesce(
    nullif(new.command_payload #>> '{identityAudit,activeRole}', ''),
    nullif(new.command_payload ->> 'activePersona', ''),
    new.actor_role
  );
  new.truth_status := coalesce(
    nullif(new.command_payload ->> 'truthStatus', ''),
    'Functional Demo'
  );
  new.simulation := coalesce(
    (new.command_payload #>> '{identityAudit,simulation}')::boolean,
    (new.command_payload ->> 'simulation')::boolean,
    false
  );
  new.reason := coalesce(
    nullif(new.command_payload ->> 'rationale', ''),
    nullif(new.command_payload ->> 'reason', '')
  );
  new.evidence := coalesce(
    new.command_payload -> 'evidence',
    '[]'::jsonb
  );
  new.assurance_level := nullif(
    new.command_payload #>> '{identityAudit,assuranceLevel}',
    ''
  );
  new.assignment_type := nullif(
    new.command_payload #>> '{identityAudit,assignmentType}',
    ''
  );
  new.protected_action := coalesce(
    (new.command_payload #>> '{identityAudit,protectedAction}')::boolean,
    false
  );
  v_requested_at := nullif(new.command_payload ->> 'requestedAt', '');
  requested_correlation := new.command_payload ->> 'correlationId';
  new.correlation_id := case
    when requested_correlation
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then requested_correlation::uuid
    else new.command_id
  end;

  if
    new.active_persona is null
    or new.assurance_level is null
    or new.assignment_type is null
    or new.reason is null
    or length(trim(new.reason)) < 10
    or v_requested_at is null
  then
    raise exception 'AUTHORITATIVE_COMMAND_CONTEXT_REQUIRED';
  end if;

  begin
    new.requested_at := v_requested_at::timestamptz;
  exception when others then
    raise exception 'AUTHORITATIVE_COMMAND_TIMESTAMP_INVALID';
  end;
  return new;
end;
$$;

revoke all on function private.enrich_phase3_workflow_event()
  from public, anon, authenticated;

commit;
