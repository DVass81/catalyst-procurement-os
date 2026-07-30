begin;

alter table public.procurement_requests
  add column if not exists request_channel text,
  add column if not exists created_by_actor_ref text,
  add column if not exists emergency_justification text,
  add column if not exists recurring_cadence text,
  add column if not exists recurring_starts_on date,
  add column if not exists recurring_ends_on date,
  add column if not exists recurring_next_occurrence date,
  add column if not exists recurring_status text,
  add column if not exists attachment_names text[] not null default '{}';

alter table public.procurement_requests
  drop constraint if exists procurement_requests_request_channel_check;
alter table public.procurement_requests
  add constraint procurement_requests_request_channel_check
  check (
    request_channel is null
    or request_channel in (
      'catalog_goods',
      'non_catalog_goods',
      'service',
      'recurring',
      'emergency'
    )
  );

alter table public.procurement_requests
  drop constraint if exists procurement_requests_emergency_control;
alter table public.procurement_requests
  add constraint procurement_requests_emergency_control
  check (
    request_channel <> 'emergency'
    or (
      emergency_justification is not null
      and length(trim(emergency_justification)) >= 20
      and priority = 'urgent'
    )
  );

alter table public.procurement_requests
  drop constraint if exists procurement_requests_recurring_control;
alter table public.procurement_requests
  add constraint procurement_requests_recurring_control
  check (
    request_channel <> 'recurring'
    or (
      recurring_cadence in ('monthly', 'quarterly', 'annually')
      and recurring_starts_on is not null
      and recurring_next_occurrence is not null
      and recurring_next_occurrence > recurring_starts_on
      and (
        recurring_ends_on is null
        or recurring_ends_on > recurring_starts_on
      )
      and recurring_status in ('active', 'paused', 'completed')
    )
  );

alter table public.procurement_approvals
  add column if not exists routing_mode text not null default 'sequential',
  add column if not exists routing_group integer;

update public.procurement_approvals
set routing_group = sequence
where routing_group is null;

alter table public.procurement_approvals
  alter column routing_group set not null;
alter table public.procurement_approvals
  drop constraint if exists procurement_approvals_routing_mode_check;
alter table public.procurement_approvals
  add constraint procurement_approvals_routing_mode_check
  check (routing_mode in ('sequential', 'parallel'));
alter table public.procurement_approvals
  drop constraint if exists procurement_approvals_routing_group_check;
alter table public.procurement_approvals
  add constraint procurement_approvals_routing_group_check
  check (routing_group > 0);

alter table public.procurement_approvals
  drop constraint if exists procurement_approvals_tenant_id_request_id_sequence_key;
create unique index if not exists procurement_approvals_route_role_unique
  on public.procurement_approvals (
    tenant_id,
    request_id,
    routing_group,
    approver_role
  );

create or replace function private.populate_operational_request_extensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record jsonb;
begin
  select request_item.value
    into request_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'requests', '[]'::jsonb)
  ) as request_item(value)
  where snapshot.tenant_id = new.tenant_id
    and request_item.value ->> 'id' = new.id
  limit 1;

  if request_record is not null then
    new.request_channel :=
      nullif(request_record ->> 'requestChannel', '');
    new.created_by_actor_ref :=
      nullif(request_record ->> 'createdByActorId', '');
    new.emergency_justification :=
      nullif(request_record ->> 'emergencyJustification', '');
    new.recurring_cadence :=
      nullif(request_record #>> '{recurringSchedule,cadence}', '');
    new.recurring_starts_on :=
      nullif(
        request_record #>> '{recurringSchedule,startsOn}',
        ''
      )::date;
    new.recurring_ends_on :=
      nullif(
        request_record #>> '{recurringSchedule,endsOn}',
        ''
      )::date;
    new.recurring_next_occurrence :=
      nullif(
        request_record #>> '{recurringSchedule,nextOccurrence}',
        ''
      )::date;
    new.recurring_status :=
      nullif(request_record #>> '{recurringSchedule,status}', '');
    new.attachment_names := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(request_record -> 'attachments', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    );
  end if;
  return new;
end;
$$;

drop trigger if exists populate_operational_request_extensions
  on public.procurement_requests;
create trigger populate_operational_request_extensions
before insert or update on public.procurement_requests
for each row
execute function private.populate_operational_request_extensions();

create or replace function private.populate_operational_approval_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval_record jsonb;
begin
  select approval_item.value
    into approval_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'approvals', '[]'::jsonb)
  ) as approval_item(value)
  where snapshot.tenant_id = new.tenant_id
    and approval_item.value ->> 'id' = new.id
  limit 1;

  if approval_record is not null then
    new.routing_mode := coalesce(
      nullif(approval_record ->> 'routingMode', ''),
      'sequential'
    );
    new.routing_group := coalesce(
      nullif(approval_record ->> 'routingGroup', '')::integer,
      nullif(approval_record ->> 'sequence', '')::integer
    );
  elsif new.routing_group is null then
    new.routing_group := new.sequence;
  end if;
  return new;
end;
$$;

drop trigger if exists populate_operational_approval_routing
  on public.procurement_approvals;
create trigger populate_operational_approval_routing
before insert or update on public.procurement_approvals
for each row
execute function private.populate_operational_approval_routing();

update public.procurement_requests as target
set request_channel = nullif(request_record ->> 'requestChannel', ''),
    created_by_actor_ref =
      nullif(request_record ->> 'createdByActorId', ''),
    emergency_justification =
      nullif(request_record ->> 'emergencyJustification', ''),
    recurring_cadence =
      nullif(request_record #>> '{recurringSchedule,cadence}', ''),
    recurring_starts_on =
      nullif(
        request_record #>> '{recurringSchedule,startsOn}',
        ''
      )::date,
    recurring_ends_on =
      nullif(
        request_record #>> '{recurringSchedule,endsOn}',
        ''
      )::date,
    recurring_next_occurrence =
      nullif(
        request_record #>> '{recurringSchedule,nextOccurrence}',
        ''
      )::date,
    recurring_status =
      nullif(request_record #>> '{recurringSchedule,status}', ''),
    attachment_names = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(request_record -> 'attachments', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    )
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'requests', '[]'::jsonb)
) as request_record
where target.tenant_id = snapshot.tenant_id
  and target.id = request_record ->> 'id';

update public.procurement_approvals as target
set routing_mode = coalesce(
      nullif(approval ->> 'routingMode', ''),
      'sequential'
    ),
    routing_group = coalesce(
      nullif(approval ->> 'routingGroup', '')::integer,
      nullif(approval ->> 'sequence', '')::integer
    )
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'approvals', '[]'::jsonb)
) as approval
where target.tenant_id = snapshot.tenant_id
  and target.id = approval ->> 'id';

revoke all on function private.populate_operational_request_extensions()
  from public, anon, authenticated;
grant execute on function private.populate_operational_request_extensions()
  to service_role;
revoke all on function private.populate_operational_approval_routing()
  from public, anon, authenticated;
grant execute on function private.populate_operational_approval_routing()
  to service_role;

commit;
