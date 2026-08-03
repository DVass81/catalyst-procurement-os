begin;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_channel_check;
alter table public.notification_outbox
  add constraint notification_outbox_channel_check
  check (channel in ('in_app', 'email_simulated', 'email'));

alter table public.notification_outbox
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists correlation_id uuid,
  add column if not exists terminal_failed_at timestamptz,
  add column if not exists delivery_evidence jsonb not null default '{}'::jsonb;

alter table public.supplier_identity_assignments
  alter column scopes set default array[
    'supplier_profile:read',
    'supplier_profile:update',
    'supplier_evidence:submit',
    'supplier_response:submit',
    'supplier_po:acknowledge'
  ]::text[];

update public.supplier_identity_assignments
set scopes = array_append(scopes, 'supplier_po:acknowledge')
where not (scopes @> array['supplier_po:acknowledge']::text[]);

alter table private.operations_probe_runs
  drop constraint if exists operations_probe_runs_environment_kind_check;
alter table private.operations_probe_runs
  add constraint operations_probe_runs_environment_kind_check
  check (
    environment_kind in (
      'development_preview',
      'functional_test',
      'sales_demo',
      'secure_pilot'
    )
  );

create or replace function private.archive_demo_session_before_reset()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if
    (
      coalesce(new.state ->> 'stage', '') = 'draft'
      and coalesce(old.state ->> 'stage', '') <> 'draft'
    )
    or coalesce(
      new.state #>> '{phaseThree,auditEvents,-1,action}',
      ''
    ) = 'phase3.dataset.reset'
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
    );
  end if;
  return new;
end;
$$;

revoke all on function private.archive_demo_session_before_reset()
  from public, anon, authenticated;
grant execute on function private.archive_demo_session_before_reset()
  to service_role;

create or replace function private.queue_rfq_invitation_notifications()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_should_queue boolean := false;
begin
  if tg_op = 'INSERT' then
    v_should_queue := new.is_current and new.status = 'invited';
  else
    v_should_queue :=
      new.is_current
      and new.status = 'invited'
      and (
        old.status is distinct from new.status
        or old.is_current is distinct from new.is_current
      );
  end if;
  if v_should_queue then
    insert into public.notification_outbox (
      tenant_id,
      event_type,
      recipient_id,
      channel,
      delivery_state,
      dedupe_key,
      subject,
      safe_body,
      deep_link,
      mandatory,
      correlation_id
    )
    select
      new.tenant_id,
      'rfq.invitation.issued',
      assignment.user_id,
      delivery.channel,
      case when delivery.channel = 'in_app' then 'delivered' else 'pending' end,
      concat(
        new.tenant_id,
        ':',
        new.rfq_id,
        ':',
        new.supplier_id,
        ':invitation'
      ),
      concat('Catalyst RFQ invitation: ', new.rfq_id),
      concat(
        'Your organization has a new Catalyst RFQ invitation. Sign in to review the governed event ',
        new.rfq_id,
        '. Do not reply with pricing or banking information.'
      ),
      '/rfqs',
      true,
      new.last_command_id
    from public.supplier_identity_assignments as assignment
    cross join (
      values ('in_app'::text), ('email'::text)
    ) as delivery(channel)
    where assignment.tenant_id = new.tenant_id
      and assignment.supplier_organization_id =
        new.supplier_organization_id
      and assignment.supplier_id = new.supplier_id
      and assignment.status = 'active'
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
    on conflict (tenant_id, dedupe_key, channel) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.queue_rfq_invitation_notifications()
  from public, anon, authenticated;
grant execute on function private.queue_rfq_invitation_notifications()
  to service_role;

drop trigger if exists queue_rfq_invitation_notifications
  on public.procurement_rfq_suppliers;
create trigger queue_rfq_invitation_notifications
after insert or update of status, is_current
on public.procurement_rfq_suppliers
for each row execute function private.queue_rfq_invitation_notifications();

create or replace function private.queue_rfq_decision_notifications()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_current then
    insert into public.notification_outbox (
      tenant_id,
      event_type,
      recipient_id,
      channel,
      delivery_state,
      dedupe_key,
      subject,
      safe_body,
      deep_link,
      mandatory,
      correlation_id
    )
    select
      new.tenant_id,
      concat('rfq.decision.', new.notice_type),
      assignment.user_id,
      delivery.channel,
      case when delivery.channel = 'in_app' then 'delivered' else 'pending' end,
      concat(new.tenant_id, ':', new.rfq_id, ':', new.id),
      concat('Catalyst RFQ decision: ', new.rfq_id),
      new.summary,
      '/rfqs',
      true,
      new.last_command_id
    from public.procurement_rfq_suppliers as invitation
    join public.supplier_identity_assignments as assignment
      on assignment.tenant_id = invitation.tenant_id
     and assignment.supplier_organization_id =
       invitation.supplier_organization_id
     and assignment.supplier_id = invitation.supplier_id
     and assignment.status = 'active'
    cross join (
      values ('in_app'::text), ('email'::text)
    ) as delivery(channel)
    where invitation.tenant_id = new.tenant_id
      and invitation.rfq_id = new.rfq_id
      and invitation.supplier_id = new.supplier_id
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
    on conflict (tenant_id, dedupe_key, channel) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.queue_rfq_decision_notifications()
  from public, anon, authenticated;
grant execute on function private.queue_rfq_decision_notifications()
  to service_role;

drop trigger if exists queue_rfq_decision_notifications
  on public.procurement_rfq_decision_notices;
create trigger queue_rfq_decision_notifications
after insert or update of is_current
on public.procurement_rfq_decision_notices
for each row execute function private.queue_rfq_decision_notifications();

drop policy if exists tenant_member_read
  on public.notification_outbox;
drop policy if exists own_or_operations_notification_read
  on public.notification_outbox;
create policy own_or_operations_notification_read
on public.notification_outbox
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1
    from public.tenant_role_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = notification_outbox.tenant_id
      and assignment.role in (
        'operations_manager',
        'system_administrator',
        'auditor'
      )
      and assignment.suspended_at is null
      and assignment.starts_at <= now()
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
  )
);

commit;
