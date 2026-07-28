begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.procurement_demo_snapshots (
  tenant_id text primary key references public.tenant_demo_configs(tenant_id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  seed_version integer not null,
  state_checksum text not null check (state_checksum ~ '^[0-9a-f]{64}$'),
  last_command_id uuid,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.procurement_workflow_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  sequence bigint generated always as identity,
  command_id uuid not null,
  command_type text not null,
  command_payload jsonb not null,
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  state_revision bigint not null check (state_revision > 0),
  state_checksum text not null check (state_checksum ~ '^[0-9a-f]{64}$'),
  previous_event_hash text,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now(),
  unique (tenant_id, command_id),
  unique (tenant_id, state_revision)
);

create index if not exists procurement_workflow_events_tenant_time_idx
  on public.procurement_workflow_events (tenant_id, occurred_at desc);

create table if not exists public.tenant_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'requester', 'approver', 'purchasing', 'receiving',
      'accounts_payable', 'auditor', 'executive', 'system_administrator'
    )
  ),
  department_ids text[] not null default '{}',
  location_ids text[] not null default '{}',
  category_ids text[] not null default '{}',
  approval_limit_cents bigint check (approval_limit_cents is null or approval_limit_cents >= 0),
  workflow_owner_ids text[] not null default '{}',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  delegated_by uuid references auth.users(id),
  emergency_access boolean not null default false,
  emergency_justification text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, role)
);

create index if not exists tenant_role_assignments_user_tenant_idx
  on public.tenant_role_assignments (user_id, tenant_id);

insert into public.tenant_assignments (user_id, tenant_id, role)
select
  user_record.id,
  tenant_id.value,
  case
    when user_record.raw_app_meta_data ->> 'role' = 'administrator'
      then 'administrator'
    when coalesce((user_record.raw_app_meta_data ->> 'presenter')::boolean, false)
      then 'presenter'
    else 'viewer'
  end
from auth.users as user_record
cross join lateral jsonb_array_elements_text(
  coalesce(user_record.raw_app_meta_data -> 'tenant_ids', '[]'::jsonb)
) as tenant_id(value)
join public.tenant_demo_configs
  on tenant_demo_configs.tenant_id = tenant_id.value
on conflict (user_id, tenant_id) do update
set role = excluded.role;

create or replace function private.sync_auth_tenant_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tenant_assignments where user_id = new.id;
  insert into public.tenant_assignments (user_id, tenant_id, role)
  select
    new.id,
    tenant_id.value,
    case
      when new.raw_app_meta_data ->> 'role' = 'administrator'
        then 'administrator'
      when coalesce((new.raw_app_meta_data ->> 'presenter')::boolean, false)
        then 'presenter'
      else 'viewer'
    end
  from jsonb_array_elements_text(
    coalesce(new.raw_app_meta_data -> 'tenant_ids', '[]'::jsonb)
  ) as tenant_id(value)
  join public.tenant_demo_configs
    on tenant_demo_configs.tenant_id = tenant_id.value;
  return new;
end;
$$;

drop trigger if exists sync_auth_tenant_assignments on auth.users;
create trigger sync_auth_tenant_assignments
after insert or update of raw_app_meta_data on auth.users
for each row execute function private.sync_auth_tenant_assignments();

revoke all on function private.sync_auth_tenant_assignments()
  from public, anon, authenticated;

create table if not exists public.configuration_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  domain text not null,
  version integer not null check (version > 0),
  lifecycle_state text not null check (
    lifecycle_state in (
      'draft', 'validated', 'review_pending', 'approved', 'scheduled',
      'active', 'superseded', 'rolled_back'
    )
  ),
  configuration jsonb not null,
  source_label text not null default 'synthetic_demo',
  owner_id uuid references auth.users(id),
  backup_owner_id uuid references auth.users(id),
  validation_result jsonb not null default '{}'::jsonb,
  simulation_result jsonb not null default '{}'::jsonb,
  effective_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  supersedes_id uuid references public.configuration_versions(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, domain, version)
);

create unique index if not exists configuration_versions_one_active_idx
  on public.configuration_versions (tenant_id, domain)
  where lifecycle_state = 'active';

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  import_type text not null,
  lifecycle_state text not null check (
    lifecycle_state in (
      'uploaded', 'staged', 'validating', 'failed', 'ready_for_approval',
      'approved', 'posted', 'reversed'
    )
  ),
  original_filename text not null,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  mapping jsonb not null default '{}'::jsonb,
  source_system text not null,
  row_count integer not null default 0 check (row_count >= 0),
  valid_row_count integer not null default 0 check (valid_row_count >= 0),
  error_row_count integer not null default 0 check (error_row_count >= 0),
  source_total_cents bigint,
  posted_total_cents bigint,
  validation_report jsonb not null default '{}'::jsonb,
  imported_by uuid references auth.users(id),
  validated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  posted_by uuid references auth.users(id),
  reversed_by uuid references auth.users(id),
  failure_reason text,
  reversal_reason text,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_at timestamptz,
  unique (tenant_id, import_type, file_hash)
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 0),
  source_record jsonb not null,
  normalized_record jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  immutable_external_id text,
  posted_record_id text,
  created_at timestamptz not null default now(),
  unique (batch_id, source_row_number)
);

create table if not exists public.document_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  parent_entity_type text not null,
  parent_entity_id text not null,
  lifecycle_state text not null check (
    lifecycle_state in (
      'uploading', 'scanning', 'available', 'rejected', 'superseded',
      'archived', 'held', 'deleted'
    )
  ),
  current_version integer not null default 0 check (current_version >= 0),
  retention_until date,
  legal_hold boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  document_id uuid not null references public.document_records(id) on delete cascade,
  version integer not null check (version > 0),
  storage_path text not null,
  original_filename text not null,
  sanitized_filename text not null,
  declared_mime_type text not null,
  detected_mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  scan_mode text not null default 'simulated' check (scan_mode in ('simulated', 'live')),
  scan_result text not null check (scan_result in ('pending', 'clean', 'rejected', 'failed')),
  ocr_confidence numeric(5,4) check (ocr_confidence between 0 and 1),
  supersedes_version_id uuid references public.document_versions(id),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create index if not exists document_versions_hash_idx
  on public.document_versions (tenant_id, sha256);

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  document_version_id uuid not null references public.document_versions(id),
  page_locator text,
  citation_label text not null,
  pinned_for_decision boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.document_access_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (
    action in ('view', 'download', 'replace', 'ai_use', 'delete', 'restore')
  ),
  access_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.work_queue_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  queue_type text not null,
  entity_type text not null,
  entity_id text not null,
  assignee_role text not null,
  assignee_id uuid references auth.users(id),
  status text not null check (
    status in ('open', 'assigned', 'in_progress', 'blocked', 'completed', 'cancelled')
  ),
  priority text not null check (priority in ('low', 'normal', 'high', 'critical')),
  due_at timestamptz,
  escalation_level integer not null default 0 check (escalation_level >= 0),
  blocker text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists work_queue_tenant_status_due_idx
  on public.work_queue_items (tenant_id, status, due_at);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  event_type text not null,
  recipient_id uuid references auth.users(id),
  channel text not null check (channel in ('in_app', 'email_simulated')),
  delivery_state text not null check (
    delivery_state in ('pending', 'processing', 'delivered', 'failed', 'dead_letter', 'cancelled')
  ),
  dedupe_key text not null,
  subject text not null,
  safe_body text not null,
  deep_link text,
  mandatory boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key, channel)
);

create table if not exists public.cate_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  run_id text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  capability text not null,
  evidence_manifest jsonb not null,
  policy_context jsonb not null,
  confidence_band text not null check (confidence_band in ('high', 'moderate', 'low', 'insufficient')),
  output jsonb not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  fallback_used boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, run_id)
);

create table if not exists public.cate_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  evaluation_id uuid not null references public.cate_evaluations(id),
  disposition text not null check (disposition in ('accepted', 'rejected', 'modified')),
  reason text not null,
  resulting_action text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.metric_definitions (
  id text not null,
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  business_question text not null,
  classification text not null check (classification in ('outcome', 'driver', 'guardrail')),
  formula text not null,
  grain text not null,
  numerator_definition text,
  denominator_definition text,
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  owner_role text not null,
  source_lineage jsonb not null,
  refresh_cadence text not null,
  target_value numeric,
  target_unit text,
  target_owner_role text not null,
  target_label text not null default 'Synthetic demo target',
  effective_date date not null,
  action_threshold jsonb not null,
  paired_guardrail_ids text[] not null default '{}',
  drilldown_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id, version)
);

create table if not exists public.saved_metric_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  name text not null,
  owner_id uuid references auth.users(id),
  shared boolean not null default false,
  role_visibility text[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,
  metric_ids text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenant_demo_configs(tenant_id) on delete cascade,
  package_type text not null,
  subject_id text not null,
  lifecycle_state text not null check (
    lifecycle_state in ('requested', 'generating', 'completed', 'failed', 'expired')
  ),
  version integer not null check (version > 0),
  parent_package_id uuid references public.audit_packages(id),
  as_of timestamptz not null,
  manifest jsonb not null default '{}'::jsonb,
  manifest_sha256 text,
  pdf_storage_path text,
  csv_storage_path text,
  json_storage_path text,
  redaction_profile jsonb not null default '{}'::jsonb,
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  failure_reason text,
  unique (tenant_id, package_type, subject_id, version)
);

create table if not exists public.security_exception_register (
  id uuid primary key default gen_random_uuid(),
  tenant_id text references public.tenant_demo_configs(tenant_id) on delete cascade,
  control_id text not null,
  owner text not null,
  reason text not null,
  risk text not null,
  mitigation text not null,
  accepted_by text,
  expires_at date not null,
  status text not null check (status in ('open', 'accepted', 'remediated', 'expired')),
  created_at timestamptz not null default now()
);

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

  v_event_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_tenant_id,
        p_command_id::text,
        p_command_type,
        p_actor_id::text,
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'procurement_demo_snapshots',
    'procurement_workflow_events',
    'tenant_role_assignments',
    'configuration_versions',
    'import_batches',
    'import_rows',
    'document_records',
    'document_versions',
    'evidence_links',
    'document_access_events',
    'work_queue_items',
    'notification_outbox',
    'cate_evaluations',
    'cate_feedback',
    'metric_definitions',
    'saved_metric_views',
    'audit_packages',
    'security_exception_register'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('drop policy if exists tenant_member_read on public.%I', table_name);
    execute format(
      'create policy tenant_member_read on public.%I for select to authenticated using (
        tenant_id in (
          select assignment.tenant_id
          from public.tenant_assignments as assignment
          where assignment.user_id = (select auth.uid())
        )
      )',
      table_name
    );
  end loop;
end
$$;

drop policy if exists tenant_demo_configs_assigned_read
  on public.tenant_demo_configs;
create policy tenant_demo_configs_assigned_read
on public.tenant_demo_configs
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = tenant_demo_configs.tenant_id
  )
);

drop policy if exists tenant_member_read on public.tenant_role_assignments;
create policy tenant_member_read
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
      and assignment.role in ('presenter', 'administrator')
  )
);

drop policy if exists tenant_member_read
  on public.security_exception_register;
create policy tenant_member_read
on public.security_exception_register
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
      and assignment.tenant_id = security_exception_register.tenant_id
      and assignment.role = 'administrator'
  )
);

revoke all on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) to service_role;

grant usage on schema private to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on table public.tenant_demo_configs to authenticated;
grant select on table public.tenant_assignments to authenticated;
grant select, update on table public.user_profiles to authenticated;

drop trigger if exists procurement_workflow_events_immutable
  on public.procurement_workflow_events;
create trigger procurement_workflow_events_immutable
before update or delete on public.procurement_workflow_events
for each row execute function private.prevent_immutable_mutation();

drop trigger if exists document_versions_immutable
  on public.document_versions;
create trigger document_versions_immutable
before update or delete on public.document_versions
for each row execute function private.prevent_immutable_mutation();

drop trigger if exists document_access_events_immutable
  on public.document_access_events;
create trigger document_access_events_immutable
before update or delete on public.document_access_events
for each row execute function private.prevent_immutable_mutation();

drop trigger if exists cate_evaluations_immutable
  on public.cate_evaluations;
create trigger cate_evaluations_immutable
before update or delete on public.cate_evaluations
for each row execute function private.prevent_immutable_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'procurement-evidence',
  'procurement-evidence',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_evidence_read on storage.objects;
create policy tenant_evidence_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'procurement-evidence'
  and (storage.foldername(name))[1] in (
    select assignment.tenant_id
    from public.tenant_assignments as assignment
    where assignment.user_id = (select auth.uid())
  )
);

commit;
