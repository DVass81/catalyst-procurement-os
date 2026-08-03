-- Mission Back on Track M2: identity and authority foundation.
--
-- This migration keeps the current invite-only synthetic demonstration
-- available while establishing the authority controls required for a pilot.
-- Identity providers prove identity; Catalyst remains authoritative for
-- tenant, role, scope, supplier binding, delegation, and protected actions.

create table if not exists public.identity_access_policies (
  tenant_id text primary key
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  internal_access_mode text not null default 'invite_magic_link'
    check (
      internal_access_mode in (
        'invite_magic_link',
        'saml_required',
        'hybrid_transition'
      )
    ),
  supplier_access_mode text not null default 'invite_magic_link'
    check (
      supplier_access_mode in (
        'invite_magic_link',
        'federated',
        'disabled'
      )
    ),
  provisioning_mode text not null default 'manual_review'
    check (
      provisioning_mode in (
        'manual_review',
        'scim',
        'jit_with_approval'
      )
    ),
  require_aal2_for_protected_actions boolean not null default true,
  allow_synthetic_presenter_aal1 boolean not null default true,
  session_idle_minutes integer not null default 30
    check (session_idle_minutes between 5 and 720),
  session_max_minutes integer not null default 480
    check (session_max_minutes between 15 and 1440),
  emergency_access_enabled boolean not null default false,
  status text not null default 'validation_required'
    check (
      status in (
        'validation_required',
        'configured',
        'active',
        'suspended'
      )
    ),
  version integer not null default 1 check (version > 0),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (
    (status <> 'active')
    or (approved_by is not null and approved_at is not null)
  )
);

insert into public.identity_access_policies (tenant_id)
select tenant_id
from public.tenant_demo_configs
on conflict (tenant_id) do nothing;

create table if not exists public.identity_provider_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  provider_key text not null
    check (provider_key in ('magic_link', 'entra', 'okta', 'saml')),
  provider_type text not null
    check (provider_type in ('email_otp', 'saml_2_0')),
  lifecycle_state text not null default 'simulated_inactive'
    check (
      lifecycle_state in (
        'simulated_inactive',
        'configuration_draft',
        'validation_required',
        'validated',
        'active',
        'suspended'
      )
    ),
  entity_id text,
  metadata_url text,
  attribute_mappings jsonb not null default '{}'::jsonb,
  role_claim_mode text not null default 'identity_only'
    check (role_claim_mode in ('identity_only', 'propose_for_review')),
  certificate_fingerprint text,
  certificate_expires_at timestamptz,
  last_validation_at timestamptz,
  last_validation_result text
    check (
      last_validation_result is null
      or last_validation_result in ('passed', 'failed', 'limited')
    ),
  limitations text not null,
  activation_requirements text not null,
  version integer not null default 1 check (version > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_key),
  check (
    provider_key = 'magic_link'
    or lifecycle_state <> 'active'
    or (
      entity_id is not null
      and last_validation_result = 'passed'
      and last_validation_at is not null
    )
  )
);

insert into public.identity_provider_configurations (
  tenant_id,
  provider_key,
  provider_type,
  lifecycle_state,
  limitations,
  activation_requirements
)
select
  policy.tenant_id,
  provider.provider_key,
  provider.provider_type,
  case
    when provider.provider_key = 'magic_link'
      then 'validated'
    else 'simulated_inactive'
  end,
  case
    when provider.provider_key = 'magic_link'
      then 'Invite-only access; protected pilot actions still require AAL2.'
    else 'Demonstration configuration only; no external identity provider is connected.'
  end,
  case
    when provider.provider_key = 'magic_link'
      then 'Verified custom SMTP, exact redirect allowlist, invited users, and delivery evidence.'
    else 'Approved IdP metadata, certificate, claims, test identities, deprovisioning, AAL2, and owner sign-off.'
  end
from public.identity_access_policies as policy
cross join (
  values
    ('magic_link', 'email_otp'),
    ('entra', 'saml_2_0'),
    ('okta', 'saml_2_0'),
    ('saml', 'saml_2_0')
) as provider(provider_key, provider_type)
on conflict (tenant_id, provider_key) do nothing;

alter table public.tenant_role_assignments
  drop constraint if exists tenant_role_assignments_role_check;
alter table public.tenant_role_assignments
  add constraint tenant_role_assignments_role_check
  check (
    role in (
      'requester',
      'department_manager',
      'it_reviewer',
      'purchasing_specialist',
      'purchasing_manager',
      'finance_reviewer',
      'compliance_reviewer',
      'receiving_clerk',
      'accounts_payable',
      'executive',
      'auditor',
      'supplier_user',
      'contract_manager',
      'security_reviewer',
      'operations_manager',
      'system_administrator'
    )
  );

alter table public.tenant_role_assignments
  add column if not exists assignment_type text not null default 'direct'
    check (
      assignment_type in (
        'direct',
        'delegated',
        'emergency',
        'presenter_simulation'
      )
    ),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists suspended_reason text;

alter table public.tenant_role_assignments
  drop constraint if exists tenant_role_assignments_delegation_control;
alter table public.tenant_role_assignments
  add constraint tenant_role_assignments_delegation_control
  check (
    assignment_type <> 'delegated'
    or delegated_by is not null
  );

alter table public.tenant_role_assignments
  drop constraint if exists tenant_role_assignments_emergency_control;
alter table public.tenant_role_assignments
  add constraint tenant_role_assignments_emergency_control
  check (
    not emergency_access
    or (
      assignment_type = 'emergency'
      and emergency_justification is not null
      and length(trim(emergency_justification)) >= 20
      and expires_at is not null
    )
  );

-- In the synthetic environment, an authorized presenter receives explicit,
-- auditable persona-simulation entitlements. These are not pilot user roles.
insert into public.tenant_role_assignments (
  tenant_id,
  user_id,
  role,
  assignment_type,
  approved_by,
  approved_at,
  last_reviewed_at
)
select
  assignment.tenant_id,
  assignment.user_id,
  role_name,
  'presenter_simulation',
  assignment.user_id,
  now(),
  now()
from public.tenant_assignments as assignment
cross join unnest(array[
  'requester',
  'department_manager',
  'it_reviewer',
  'purchasing_specialist',
  'purchasing_manager',
  'finance_reviewer',
  'compliance_reviewer',
  'receiving_clerk',
  'accounts_payable',
  'executive',
  'auditor',
  'supplier_user',
  'contract_manager',
  'security_reviewer',
  'operations_manager',
  'system_administrator'
]) as roles(role_name)
where assignment.role in ('presenter', 'administrator')
on conflict (tenant_id, user_id, role) do update
set assignment_type = excluded.assignment_type,
    approved_by = coalesce(
      public.tenant_role_assignments.approved_by,
      excluded.approved_by
    ),
    approved_at = coalesce(
      public.tenant_role_assignments.approved_at,
      excluded.approved_at
    ),
    last_reviewed_at = excluded.last_reviewed_at,
    suspended_at = null,
    suspended_reason = null;

create table if not exists public.supplier_identity_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_organization_id text not null,
  supplier_id text not null,
  status text not null default 'invited'
    check (
      status in (
        'invited',
        'active',
        'suspended',
        'revoked',
        'expired'
      )
    ),
  scopes text[] not null default array[
    'supplier_profile:read',
    'supplier_profile:update',
    'supplier_evidence:submit',
    'supplier_response:submit'
  ]::text[],
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, supplier_organization_id),
  check (
    status <> 'active'
    or (accepted_at is not null and suspended_at is null)
  ),
  check (
    status <> 'suspended'
    or (
      suspended_at is not null
      and suspension_reason is not null
      and length(trim(suspension_reason)) >= 10
    )
  )
);

create table if not exists public.identity_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  delegator_id uuid not null references auth.users(id),
  delegate_id uuid not null references auth.users(id),
  role text not null,
  department_ids text[] not null default '{}'::text[],
  location_ids text[] not null default '{}'::text[],
  category_ids text[] not null default '{}'::text[],
  approval_limit_cents bigint check (
    approval_limit_cents is null or approval_limit_cents >= 0
  ),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'active',
        'expired',
        'revoked',
        'rejected'
      )
    ),
  reason text not null check (length(trim(reason)) >= 20),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (delegator_id <> delegate_id),
  check (expires_at > starts_at),
  check (
    status not in ('approved', 'active')
    or (
      approved_by is not null
      and approved_at is not null
      and approved_by <> delegator_id
      and approved_by <> delegate_id
    )
  )
);

create table if not exists public.identity_dual_control_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  action_type text not null,
  resource_type text not null,
  resource_id text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  requested_by uuid not null references auth.users(id),
  requested_role text not null,
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_role text,
  approved_at timestamptz,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'executed',
        'expired',
        'cancelled'
      )
    ),
  expires_at timestamptz not null,
  rationale text not null check (length(trim(rationale)) >= 20),
  correlation_id uuid not null,
  audit_reference text,
  unique (tenant_id, correlation_id),
  check (expires_at > requested_at),
  check (
    approved_by is null
    or approved_by <> requested_by
  ),
  check (
    status not in ('approved', 'executed')
    or (
      approved_by is not null
      and approved_role is not null
      and approved_at is not null
    )
  )
);

create table if not exists public.identity_access_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text references public.tenant_demo_configs(tenant_id)
    on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  role text,
  supplier_organization_id text,
  outcome text not null
    check (outcome in ('allowed', 'denied', 'challenged', 'recorded')),
  assurance_level text not null
    check (assurance_level in ('aal1', 'aal2', 'unknown')),
  correlation_id uuid not null,
  rationale text not null,
  metadata jsonb not null default '{}'::jsonb,
  previous_event_hash text check (
    previous_event_hash is null
    or previous_event_hash ~ '^[0-9a-f]{64}$'
  ),
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now(),
  unique (tenant_id, event_hash)
);

create index if not exists tenant_role_assignments_active_user_idx
  on public.tenant_role_assignments (user_id, tenant_id, role)
  where suspended_at is null;
create index if not exists tenant_role_assignments_expiry_idx
  on public.tenant_role_assignments (expires_at)
  where expires_at is not null and suspended_at is null;
create index if not exists supplier_identity_assignments_user_idx
  on public.supplier_identity_assignments (user_id, tenant_id, status);
create index if not exists supplier_identity_assignments_supplier_idx
  on public.supplier_identity_assignments (
    tenant_id,
    supplier_organization_id,
    status
  );
create index if not exists identity_delegations_delegate_active_idx
  on public.identity_delegations (delegate_id, tenant_id, starts_at, expires_at)
  where status in ('approved', 'active');
create index if not exists identity_dual_control_pending_idx
  on public.identity_dual_control_requests (tenant_id, expires_at)
  where status = 'pending';
create index if not exists identity_access_events_tenant_time_idx
  on public.identity_access_events (tenant_id, occurred_at desc);
create index if not exists identity_access_events_user_time_idx
  on public.identity_access_events (user_id, occurred_at desc)
  where user_id is not null;

create or replace function private.record_identity_access_event(
  p_tenant_id text,
  p_user_id uuid,
  p_event_type text,
  p_role text,
  p_supplier_organization_id text,
  p_outcome text,
  p_assurance_level text,
  p_correlation_id uuid,
  p_rationale text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid := gen_random_uuid();
  v_previous_hash text;
  v_event_hash text;
begin
  if p_outcome not in ('allowed', 'denied', 'challenged', 'recorded') then
    raise exception 'INVALID_IDENTITY_OUTCOME';
  end if;
  if p_assurance_level not in ('aal1', 'aal2', 'unknown') then
    raise exception 'INVALID_ASSURANCE_LEVEL';
  end if;
  if length(trim(p_event_type)) = 0 or length(trim(p_rationale)) = 0 then
    raise exception 'IDENTITY_EVENT_DETAIL_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(p_tenant_id, 'global'), 0)
  );

  select event_hash
  into v_previous_hash
  from public.identity_access_events
  where tenant_id is not distinct from p_tenant_id
  order by occurred_at desc, id desc
  limit 1;

  v_event_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        v_event_id::text,
        coalesce(p_tenant_id, ''),
        coalesce(p_user_id::text, ''),
        p_event_type,
        coalesce(p_role, ''),
        coalesce(p_supplier_organization_id, ''),
        p_outcome,
        p_assurance_level,
        p_correlation_id::text,
        p_rationale,
        p_metadata::text,
        coalesce(v_previous_hash, '')
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.identity_access_events (
    id,
    tenant_id,
    user_id,
    event_type,
    role,
    supplier_organization_id,
    outcome,
    assurance_level,
    correlation_id,
    rationale,
    metadata,
    previous_event_hash,
    event_hash
  )
  values (
    v_event_id,
    p_tenant_id,
    p_user_id,
    p_event_type,
    p_role,
    p_supplier_organization_id,
    p_outcome,
    p_assurance_level,
    p_correlation_id,
    p_rationale,
    coalesce(p_metadata, '{}'::jsonb),
    v_previous_hash,
    v_event_hash
  );

  return v_event_id;
end;
$$;

create or replace function public.identity_authority_snapshot(
  p_user_id uuid,
  p_tenant_id text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tenantId', p_tenant_id,
    'policy', coalesce(
      (
        select jsonb_build_object(
          'internalAccessMode', policy.internal_access_mode,
          'supplierAccessMode', policy.supplier_access_mode,
          'provisioningMode', policy.provisioning_mode,
          'requireAal2ForProtectedActions',
            policy.require_aal2_for_protected_actions,
          'allowSyntheticPresenterAal1',
            policy.allow_synthetic_presenter_aal1,
          'status', policy.status,
          'version', policy.version
        )
        from public.identity_access_policies as policy
        where policy.tenant_id = p_tenant_id
      ),
      '{}'::jsonb
    ),
    'roles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'role', assignment.role,
            'assignmentType', assignment.assignment_type,
            'departmentIds', assignment.department_ids,
            'locationIds', assignment.location_ids,
            'categoryIds', assignment.category_ids,
            'approvalLimitCents', assignment.approval_limit_cents,
            'workflowOwnerIds', assignment.workflow_owner_ids,
            'startsAt', assignment.starts_at,
            'expiresAt', assignment.expires_at,
            'emergencyAccess', assignment.emergency_access
          )
          order by assignment.role
        )
        from public.tenant_role_assignments as assignment
        where assignment.user_id = p_user_id
          and assignment.tenant_id = p_tenant_id
          and assignment.suspended_at is null
          and assignment.starts_at <= now()
          and (
            assignment.expires_at is null
            or assignment.expires_at > now()
          )
      ),
      '[]'::jsonb
    ),
    'supplierAccess', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'supplierOrganizationId',
              supplier_assignment.supplier_organization_id,
            'supplierId', supplier_assignment.supplier_id,
            'scopes', supplier_assignment.scopes,
            'expiresAt', supplier_assignment.expires_at
          )
          order by supplier_assignment.supplier_organization_id
        )
        from public.supplier_identity_assignments as supplier_assignment
        where supplier_assignment.user_id = p_user_id
          and supplier_assignment.tenant_id = p_tenant_id
          and supplier_assignment.status = 'active'
          and (
            supplier_assignment.expires_at is null
            or supplier_assignment.expires_at > now()
          )
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function private.record_command_identity_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_identity jsonb;
begin
  v_identity := new.command_payload -> 'identityAudit';
  if v_identity is null or jsonb_typeof(v_identity) <> 'object' then
    return new;
  end if;

  perform private.record_identity_access_event(
    new.tenant_id,
    new.actor_id,
    concat('procurement.command.', new.command_type),
    coalesce(nullif(v_identity ->> 'activeRole', ''), new.actor_role),
    nullif(v_identity ->> 'supplierOrganizationId', ''),
    'allowed',
    coalesce(v_identity ->> 'assuranceLevel', 'unknown'),
    new.correlation_id,
    coalesce(
      nullif(new.command_payload ->> 'reason', ''),
      'Authorized governed procurement command.'
    ),
    jsonb_build_object(
      'assignmentType',
        coalesce(v_identity ->> 'assignmentType', 'unknown'),
      'tenantAssignmentRole', new.actor_role,
      'protectedAction',
        coalesce((v_identity ->> 'protectedAction')::boolean, false),
      'simulation',
        coalesce((v_identity ->> 'simulation')::boolean, false),
      'commandId', new.command_id,
      'resultRevision', new.result_revision
    )
  );
  return new;
end;
$$;

drop trigger if exists procurement_command_identity_event
  on public.procurement_command_ledger;
create trigger procurement_command_identity_event
after insert on public.procurement_command_ledger
for each row execute function private.record_command_identity_event();

revoke all on function private.record_identity_access_event(
  text, uuid, text, text, text, text, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function private.record_identity_access_event(
  text, uuid, text, text, text, text, text, uuid, text, jsonb
) to service_role;

revoke all on function public.identity_authority_snapshot(uuid, text)
  from public, anon, authenticated;
grant execute on function public.identity_authority_snapshot(uuid, text)
  to service_role;
revoke all on function private.record_command_identity_event()
  from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'identity_access_policies',
    'identity_provider_configurations',
    'supplier_identity_assignments',
    'identity_delegations',
    'identity_dual_control_requests',
    'identity_access_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      table_name
    );
    execute format(
      'grant all on table public.%I to service_role',
      table_name
    );
  end loop;
end
$$;

grant select on table public.identity_access_policies to authenticated;
grant select on table public.identity_provider_configurations to authenticated;
grant select on table public.supplier_identity_assignments to authenticated;
grant select on table public.identity_delegations to authenticated;
grant select on table public.identity_dual_control_requests to authenticated;
grant select on table public.identity_access_events to authenticated;

drop policy if exists own_or_tenant_policy_read
  on public.identity_access_policies;
create policy own_or_tenant_policy_read
on public.identity_access_policies
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = identity_access_policies.tenant_id
  )
  or exists (
    select 1
    from public.supplier_identity_assignments as supplier_assignment
    where supplier_assignment.user_id = (select auth.uid())
      and supplier_assignment.tenant_id = identity_access_policies.tenant_id
      and supplier_assignment.status = 'active'
  )
);

drop policy if exists assigned_provider_read
  on public.identity_provider_configurations;
create policy assigned_provider_read
on public.identity_provider_configurations
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = identity_provider_configurations.tenant_id
  )
);

drop policy if exists own_supplier_identity_read
  on public.supplier_identity_assignments;
create policy own_supplier_identity_read
on public.supplier_identity_assignments
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists delegation_participant_read
  on public.identity_delegations;
create policy delegation_participant_read
on public.identity_delegations
for select
to authenticated
using (
  delegator_id = (select auth.uid())
  or delegate_id = (select auth.uid())
  or approved_by = (select auth.uid())
);

drop policy if exists dual_control_participant_read
  on public.identity_dual_control_requests;
create policy dual_control_participant_read
on public.identity_dual_control_requests
for select
to authenticated
using (
  requested_by = (select auth.uid())
  or approved_by = (select auth.uid())
);

drop policy if exists own_identity_event_read
  on public.identity_access_events;
create policy own_identity_event_read
on public.identity_access_events
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists tenant_member_read
  on public.tenant_role_assignments;
drop policy if exists own_role_assignment_read
  on public.tenant_role_assignments;
create policy own_role_assignment_read
on public.tenant_role_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = tenant_role_assignments.tenant_id
      and assignment.role = 'administrator'
  )
);

drop trigger if exists identity_access_events_append_only
  on public.identity_access_events;
create trigger identity_access_events_append_only
before update or delete on public.identity_access_events
for each row execute function private.prevent_procurement_evidence_mutation();

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
