begin;

alter table public.procurement_workflow_events
  add column if not exists active_persona text,
  add column if not exists truth_status text not null default 'Functional Demo'
    check (
      truth_status in (
        'Live',
        'Functional Demo',
        'Simulated Integration',
        'Concept Preview',
        'Future Activation'
      )
    ),
  add column if not exists simulation boolean not null default false,
  add column if not exists reason text,
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists correlation_id uuid;

create or replace function private.enrich_phase3_workflow_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  requested_correlation text;
begin
  new.active_persona := coalesce(
    nullif(new.command_payload ->> 'activePersona', ''),
    new.actor_role
  );
  new.truth_status := coalesce(
    nullif(new.command_payload ->> 'truthStatus', ''),
    'Functional Demo'
  );
  new.simulation := coalesce(
    (new.command_payload ->> 'simulation')::boolean,
    false
  );
  new.reason := nullif(new.command_payload ->> 'reason', '');
  new.evidence := coalesce(new.command_payload -> 'evidence', '[]'::jsonb);
  requested_correlation := new.command_payload ->> 'correlationId';
  new.correlation_id := case
    when requested_correlation ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then requested_correlation::uuid
    else new.command_id
  end;
  return new;
end;
$$;

drop trigger if exists enrich_phase3_workflow_event
  on public.procurement_workflow_events;
create trigger enrich_phase3_workflow_event
before insert on public.procurement_workflow_events
for each row execute function private.enrich_phase3_workflow_event();

revoke all on function private.enrich_phase3_workflow_event()
  from public, anon, authenticated;

create or replace function private.commit_demo_command(
  p_tenant_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_revision bigint,
  p_command_id uuid,
  p_command_type text,
  p_command jsonb,
  p_next_state jsonb,
  p_state_checksum text
)
returns table (
  state jsonb,
  revision bigint,
  last_command_id uuid,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.procurement_demo_snapshots%rowtype;
  v_previous_hash text;
  v_next_revision bigint;
  v_event_hash text;
begin
  select *
    into v_current
    from public.procurement_demo_snapshots
    where tenant_id = p_tenant_id
    for update;

  if not found then
    raise exception 'STATE_NOT_INITIALIZED';
  end if;

  if v_current.last_command_id = p_command_id then
    return query
      select v_current.state, v_current.revision, p_command_id, true;
    return;
  end if;

  if v_current.revision <> p_expected_revision then
    raise exception 'REVISION_CONFLICT';
  end if;

  v_next_revision := v_current.revision + 1;
  select event_hash
    into v_previous_hash
    from public.procurement_workflow_events
    where tenant_id = p_tenant_id
    order by state_revision desc
    limit 1;

  -- The complete command JSON is part of the chain from this release forward.
  -- It binds persona, truth status, simulation, rationale, evidence, and
  -- correlation metadata to the state revision and checksum.
  v_event_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_tenant_id,
        p_command_id::text,
        p_command_type,
        p_command::text,
        p_actor_id::text,
        p_actor_role,
        v_next_revision::text,
        p_state_checksum,
        coalesce(v_previous_hash, '')
      ),
      'sha256'
    ),
    'hex'
  );

  update public.procurement_demo_snapshots
    set state = p_next_state,
        revision = v_next_revision,
        state_checksum = p_state_checksum,
        last_command_id = p_command_id,
        updated_by = p_actor_id,
        updated_at = now()
    where tenant_id = p_tenant_id;

  insert into public.procurement_workflow_events (
    tenant_id,
    command_id,
    command_type,
    command_payload,
    actor_id,
    actor_role,
    state_revision,
    state_checksum,
    previous_event_hash,
    event_hash
  )
  values (
    p_tenant_id,
    p_command_id,
    p_command_type,
    p_command,
    p_actor_id,
    p_actor_role,
    v_next_revision,
    p_state_checksum,
    v_previous_hash,
    v_event_hash
  );

  return query
    select p_next_state, v_next_revision, p_command_id, false;
end;
$$;

revoke all on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) to service_role;

create table if not exists public.phase3_capability_registry (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  capability_id text not null,
  name text not null,
  description text not null,
  owning_module text not null,
  status text not null check (
    status in (
      'Live',
      'Functional Demo',
      'Simulated Integration',
      'Concept Preview',
      'Future Activation'
    )
  ),
  implementation_evidence jsonb not null default '[]'::jsonb,
  data_source text not null,
  provider_dependency text,
  customer_dependency text,
  security_considerations text not null,
  known_limitations text not null,
  activation_requirements text not null,
  release_first_verified text,
  last_verification_result text not null default 'Not yet verified',
  owner text not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, capability_id)
);

create table if not exists public.phase3_dataset_versions (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  dataset_version text not null,
  schema_version integer not null check (schema_version > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  effective_release text not null,
  demonstration_date date not null,
  expected_record_counts jsonb not null,
  expected_totals jsonb not null,
  expected_outcomes jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, dataset_version)
);

create table if not exists public.phase3_integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  connection_key text not null,
  adapter_key text not null,
  name text not null,
  truth_status text not null check (
    truth_status in ('Functional Demo', 'Simulated Integration', 'Future Activation')
  ),
  lifecycle_state text not null check (
    lifecycle_state in ('draft', 'tested', 'ready', 'active', 'failed', 'disabled')
  ),
  mapping_version integer not null default 1 check (mapping_version > 0),
  source_of_truth jsonb not null,
  configuration jsonb not null default '{}'::jsonb,
  activation_requirements jsonb not null default '[]'::jsonb,
  last_tested_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, connection_key)
);

create table if not exists public.phase3_integration_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  connection_key text not null,
  batch_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null check (
    status in (
      'staged', 'validating', 'ready_for_approval', 'approved', 'posted',
      'partially_failed', 'failed', 'dead_letter', 'replayed', 'reconciled',
      'reversed', 'superseded'
    )
  ),
  record_count integer not null check (record_count >= 0),
  accepted_count integer not null check (accepted_count >= 0),
  rejected_count integer not null check (rejected_count >= 0),
  source_total_cents bigint not null default 0,
  posted_total_cents bigint not null default 0,
  mapping_version integer not null check (mapping_version > 0),
  source_timestamp timestamptz not null,
  ingestion_timestamp timestamptz not null default now(),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  checkpoint text,
  retry_count integer not null default 0 check (retry_count >= 0),
  validation_findings jsonb not null default '[]'::jsonb,
  reconciliation jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  simulated boolean not null default true,
  unique (tenant_id, connection_key, batch_id)
);

create table if not exists public.phase3_supplier_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  supplier_id text not null,
  supplier_organization_id text not null,
  supplier_user_id uuid references auth.users(id),
  lifecycle_state text not null check (
    lifecycle_state in (
      'invited', 'in_progress', 'submitted', 'automated_validation',
      'internal_review', 'information_required', 'approved',
      'conditionally_approved', 'rejected', 'active', 'suspended',
      'expired', 'recertification'
    )
  ),
  risk_tier text not null check (risk_tier in ('low', 'moderate', 'high', 'critical')),
  document_status text not null check (
    document_status in ('missing', 'incomplete', 'current', 'expiring', 'expired')
  ),
  review_domains jsonb not null,
  remediation_items jsonb not null default '[]'::jsonb,
  banking_change jsonb,
  version integer not null default 1 check (version > 0),
  correlation_id uuid not null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, supplier_id)
);

create table if not exists public.phase3_contract_intelligence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  contract_id text not null,
  document_version integer not null check (document_version > 0),
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  lifecycle_state text not null check (
    lifecycle_state in ('uploaded', 'extracting', 'review_required', 'validated', 'superseded')
  ),
  extraction_method text not null,
  findings jsonb not null,
  obligations jsonb not null,
  conflicts jsonb not null,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  correlation_id uuid not null,
  unique (tenant_id, contract_id, document_version)
);

create table if not exists public.phase3_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  workflow_key text not null,
  version integer not null check (version > 0),
  lifecycle_state text not null check (
    lifecycle_state in (
      'draft', 'validated', 'simulated', 'review_pending', 'approved',
      'scheduled', 'active', 'superseded', 'rolled_back'
    )
  ),
  definition jsonb not null,
  validation_findings jsonb not null default '[]'::jsonb,
  simulation_result jsonb,
  authored_by uuid,
  approved_by uuid,
  effective_at timestamptz,
  correlation_id uuid not null,
  unique (tenant_id, workflow_key, version)
);

create table if not exists public.phase3_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  snapshot_key text not null,
  report_key text not null,
  report_version integer not null check (report_version > 0),
  as_of timestamptz not null,
  filters jsonb not null,
  certified_measures jsonb not null,
  source_record_ids jsonb not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  export_hashes jsonb not null default '{}'::jsonb,
  narrative jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, snapshot_key)
);

create table if not exists public.phase3_assurance_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  finding_key text not null,
  domain text not null check (domain in ('security', 'accessibility', 'privacy', 'operations')),
  control_id text not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium', 'Low')),
  status text not null check (
    status in ('open', 'remediating', 'ready_for_retest', 'resolved', 'accepted')
  ),
  evidence jsonb not null,
  failure_scenario text not null,
  owner text not null,
  remediation text not null,
  due_date date,
  retest jsonb,
  residual_risk text,
  acceptance_authority text,
  release_effect text not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, finding_key)
);

create table if not exists public.phase3_operations_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  record_type text not null check (
    record_type in ('health_signal', 'alert', 'incident', 'support_case', 'runbook')
  ),
  record_key text not null,
  status text not null,
  severity text,
  owner text not null,
  payload jsonb not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, record_type, record_key)
);

create table if not exists public.phase3_rehearsal_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  release_id text not null,
  dataset_version text not null,
  dataset_hash text not null check (dataset_hash ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  presenter text not null,
  environment jsonb not null,
  provider_modes jsonb not null,
  scene_results jsonb not null,
  fallback_event jsonb not null,
  integrity_result jsonb not null,
  result text not null check (result in ('pass', 'fail')),
  created_at timestamptz not null default now()
);

create table if not exists public.phase3_release_manifests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  release_id text not null,
  git_commit text not null check (git_commit ~ '^[0-9a-f]{40}$'),
  branch text not null,
  deployment jsonb not null,
  capability_registry_version integer not null check (capability_registry_version > 0),
  dataset_version text not null,
  dataset_hash text not null check (dataset_hash ~ '^[0-9a-f]{64}$'),
  verification jsonb not null,
  findings jsonb not null,
  limitations jsonb not null,
  rollback_target text not null check (rollback_target ~ '^[0-9a-f]{40}$'),
  sign_offs jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, release_id)
);

create index if not exists phase3_integration_runs_tenant_time_idx
  on public.phase3_integration_runs (tenant_id, ingestion_timestamp desc);
create index if not exists phase3_supplier_applications_tenant_state_idx
  on public.phase3_supplier_applications (tenant_id, lifecycle_state);
create index if not exists phase3_contract_intelligence_tenant_contract_idx
  on public.phase3_contract_intelligence (tenant_id, contract_id, document_version desc);
create index if not exists phase3_workflow_versions_tenant_key_idx
  on public.phase3_workflow_versions (tenant_id, workflow_key, version desc);
create index if not exists phase3_report_snapshots_tenant_time_idx
  on public.phase3_report_snapshots (tenant_id, as_of desc);
create index if not exists phase3_assurance_findings_tenant_status_idx
  on public.phase3_assurance_findings (tenant_id, domain, status, severity);
create index if not exists phase3_operations_records_tenant_type_idx
  on public.phase3_operations_records (tenant_id, record_type, status);

create or replace function private.prevent_phase3_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PHASE3_RELEASE_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists phase3_rehearsals_append_only
  on public.phase3_rehearsal_records;
create trigger phase3_rehearsals_append_only
before update or delete on public.phase3_rehearsal_records
for each row execute function private.prevent_phase3_evidence_mutation();

drop trigger if exists phase3_manifests_append_only
  on public.phase3_release_manifests;
create trigger phase3_manifests_append_only
before update or delete on public.phase3_release_manifests
for each row execute function private.prevent_phase3_evidence_mutation();

revoke all on function private.prevent_phase3_evidence_mutation()
  from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'phase3_capability_registry',
    'phase3_dataset_versions',
    'phase3_integration_connections',
    'phase3_integration_runs',
    'phase3_supplier_applications',
    'phase3_contract_intelligence',
    'phase3_workflow_versions',
    'phase3_report_snapshots',
    'phase3_assurance_findings',
    'phase3_operations_records',
    'phase3_rehearsal_records',
    'phase3_release_manifests'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format(
      'create policy tenant_member_read on public.%I for select to authenticated using (
        exists (
          select 1
          from public.tenant_assignments as assignment
          where assignment.user_id = (select auth.uid())
            and assignment.tenant_id = tenant_id
        )
      )',
      table_name
    );
  end loop;
end
$$;

drop policy if exists tenant_member_read
  on public.phase3_supplier_applications;
create policy tenant_or_supplier_read
on public.phase3_supplier_applications
for select
to authenticated
using (
  supplier_user_id = (select auth.uid())
  or exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = phase3_supplier_applications.tenant_id
      and assignment.role in ('presenter', 'administrator')
  )
);

grant usage, select on all sequences in schema public to service_role;

commit;
