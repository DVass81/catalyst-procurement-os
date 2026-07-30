begin;

-- Normalized sourcing-governance records. The command ledger and hash-chained
-- record versions remain the immutable history; these tables are the current
-- server-authorized operational projection.
create table if not exists public.procurement_rfq_amendments (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  amendment_version integer not null check (amendment_version > 0),
  issued_at timestamptz not null,
  issued_by_role text not null,
  rationale text not null check (length(trim(rationale)) >= 20),
  changes jsonb not null check (
    jsonb_typeof(changes) = 'array'
    and jsonb_array_length(changes) > 0
  ),
  response_deadline date not null,
  superseded_response_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(superseded_response_ids) = 'array'),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  unique (tenant_id, rfq_id, amendment_version),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_rfq_addenda (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  addendum_version integer not null check (addendum_version > 0),
  issued_at timestamptz not null,
  issued_by_role text not null,
  title text not null,
  content text not null,
  source_question_id text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  unique (tenant_id, rfq_id, addendum_version),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_rfq_questions (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  supplier_id text not null,
  supplier_organization_id text not null,
  question text not null,
  submitted_at timestamptz not null,
  status text not null check (status in ('open', 'answered')),
  answer text,
  answered_at timestamptz,
  answered_by_role text,
  addendum_id text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  foreign key (tenant_id, rfq_id, supplier_id)
    references public.procurement_rfq_suppliers(
      tenant_id, rfq_id, supplier_id
    ),
  foreign key (tenant_id, rfq_id, addendum_id)
    references public.procurement_rfq_addenda(tenant_id, rfq_id, id),
  check (
    (status = 'open' and answer is null and addendum_id is null)
    or
    (
      status = 'answered'
      and answer is not null
      and answered_at is not null
      and answered_by_role is not null
      and addendum_id is not null
    )
  )
);

create table if not exists public.procurement_rfq_conflicts (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  disclosed_by_role text not null,
  supplier_id text,
  description text not null,
  status text not null check (status in ('open', 'mitigated', 'recused')),
  disclosed_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by_role text,
  resolution text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id) on delete cascade,
  foreign key (tenant_id, rfq_id, supplier_id)
    references public.procurement_rfq_suppliers(
      tenant_id, rfq_id, supplier_id
    ),
  check (
    (status = 'open' and resolved_at is null and resolution is null)
    or
    (
      status in ('mitigated', 'recused')
      and resolved_at is not null
      and resolved_by_role is not null
      and resolution is not null
    )
  )
);

create table if not exists public.procurement_rfq_negotiations (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  supplier_id text not null,
  negotiation_round integer not null check (negotiation_round > 0),
  recorded_at timestamptz not null,
  recorded_by_role text not null,
  summary text not null check (length(trim(summary)) >= 20),
  evidence jsonb not null check (
    jsonb_typeof(evidence) = 'array'
    and jsonb_array_length(evidence) > 0
  ),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  foreign key (tenant_id, rfq_id, supplier_id)
    references public.procurement_rfq_suppliers(
      tenant_id, rfq_id, supplier_id
    )
);

create table if not exists public.procurement_rfq_decision_notices (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  supplier_id text not null,
  notice_type text not null check (
    notice_type in ('award', 'non_award', 'cancellation')
  ),
  issued_at timestamptz not null,
  issued_by_role text not null,
  summary text not null,
  evidence jsonb not null check (
    jsonb_typeof(evidence) = 'array'
    and jsonb_array_length(evidence) > 0
  ),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, id),
  foreign key (tenant_id, rfq_id, supplier_id)
    references public.procurement_rfq_suppliers(
      tenant_id, rfq_id, supplier_id
    )
);

create index if not exists procurement_rfq_questions_supplier_idx
  on public.procurement_rfq_questions (
    tenant_id, supplier_organization_id, status
  );
create index if not exists procurement_rfq_conflicts_status_idx
  on public.procurement_rfq_conflicts (tenant_id, rfq_id, status);
create index if not exists procurement_rfq_notices_supplier_idx
  on public.procurement_rfq_decision_notices (
    tenant_id, supplier_id, notice_type
  );

alter table public.procurement_rfq_amendments enable row level security;
alter table public.procurement_rfq_addenda enable row level security;
alter table public.procurement_rfq_questions enable row level security;
alter table public.procurement_rfq_conflicts enable row level security;
alter table public.procurement_rfq_negotiations enable row level security;
alter table public.procurement_rfq_decision_notices enable row level security;

create or replace function private.sync_rfq_governance_kernel(
  p_tenant_id text,
  p_state jsonb,
  p_revision bigint,
  p_command_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.procurement_rfq_amendments
    set is_current = false where tenant_id = p_tenant_id;
  update public.procurement_rfq_addenda
    set is_current = false where tenant_id = p_tenant_id;
  update public.procurement_rfq_questions
    set is_current = false where tenant_id = p_tenant_id;
  update public.procurement_rfq_conflicts
    set is_current = false where tenant_id = p_tenant_id;
  update public.procurement_rfq_negotiations
    set is_current = false where tenant_id = p_tenant_id;
  update public.procurement_rfq_decision_notices
    set is_current = false where tenant_id = p_tenant_id;

  insert into public.procurement_rfq_amendments (
    tenant_id, rfq_id, id, amendment_version, issued_at, issued_by_role,
    rationale, changes, response_deadline, superseded_response_ids,
    source_revision, last_command_id, is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', amendment ->> 'id',
    (amendment ->> 'version')::integer,
    (amendment ->> 'issuedAt')::timestamptz,
    amendment ->> 'issuedByRole', amendment ->> 'rationale',
    coalesce(amendment -> 'changes', '[]'::jsonb),
    (amendment ->> 'responseDeadline')::date,
    coalesce(amendment -> 'supersededResponseIds', '[]'::jsonb),
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'amendments', '[]'::jsonb)
  ) as amendment
  on conflict (tenant_id, rfq_id, id) do update
  set amendment_version = excluded.amendment_version,
      issued_at = excluded.issued_at,
      issued_by_role = excluded.issued_by_role,
      rationale = excluded.rationale,
      changes = excluded.changes,
      response_deadline = excluded.response_deadline,
      superseded_response_ids = excluded.superseded_response_ids,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_rfq_addenda (
    tenant_id, rfq_id, id, addendum_version, issued_at, issued_by_role,
    title, content, source_question_id, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', addendum ->> 'id',
    (addendum ->> 'version')::integer,
    (addendum ->> 'issuedAt')::timestamptz,
    addendum ->> 'issuedByRole', addendum ->> 'title',
    addendum ->> 'content', addendum ->> 'sourceQuestionId',
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'addenda', '[]'::jsonb)
  ) as addendum
  on conflict (tenant_id, rfq_id, id) do update
  set addendum_version = excluded.addendum_version,
      issued_at = excluded.issued_at,
      issued_by_role = excluded.issued_by_role,
      title = excluded.title,
      content = excluded.content,
      source_question_id = excluded.source_question_id,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_rfq_questions (
    tenant_id, rfq_id, id, supplier_id, supplier_organization_id, question,
    submitted_at, status, answer, answered_at, answered_by_role, addendum_id,
    source_revision, last_command_id, is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', question ->> 'id',
    question ->> 'supplierId', question ->> 'supplierOrganizationId',
    question ->> 'question', (question ->> 'submittedAt')::timestamptz,
    question ->> 'status', question ->> 'answer',
    nullif(question ->> 'answeredAt', '')::timestamptz,
    question ->> 'answeredByRole', question ->> 'addendumId',
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'questions', '[]'::jsonb)
  ) as question
  on conflict (tenant_id, rfq_id, id) do update
  set supplier_id = excluded.supplier_id,
      supplier_organization_id = excluded.supplier_organization_id,
      question = excluded.question,
      submitted_at = excluded.submitted_at,
      status = excluded.status,
      answer = excluded.answer,
      answered_at = excluded.answered_at,
      answered_by_role = excluded.answered_by_role,
      addendum_id = excluded.addendum_id,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_rfq_conflicts (
    tenant_id, rfq_id, id, disclosed_by_role, supplier_id, description,
    status, disclosed_at, resolved_at, resolved_by_role, resolution,
    source_revision, last_command_id, is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', conflict ->> 'id',
    conflict ->> 'disclosedByRole', conflict ->> 'supplierId',
    conflict ->> 'description', conflict ->> 'status',
    (conflict ->> 'disclosedAt')::timestamptz,
    nullif(conflict ->> 'resolvedAt', '')::timestamptz,
    conflict ->> 'resolvedByRole', conflict ->> 'resolution',
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'conflicts', '[]'::jsonb)
  ) as conflict
  on conflict (tenant_id, rfq_id, id) do update
  set disclosed_by_role = excluded.disclosed_by_role,
      supplier_id = excluded.supplier_id,
      description = excluded.description,
      status = excluded.status,
      disclosed_at = excluded.disclosed_at,
      resolved_at = excluded.resolved_at,
      resolved_by_role = excluded.resolved_by_role,
      resolution = excluded.resolution,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_rfq_negotiations (
    tenant_id, rfq_id, id, supplier_id, negotiation_round, recorded_at,
    recorded_by_role, summary, evidence, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', negotiation ->> 'id',
    negotiation ->> 'supplierId',
    (negotiation ->> 'round')::integer,
    (negotiation ->> 'recordedAt')::timestamptz,
    negotiation ->> 'recordedByRole', negotiation ->> 'summary',
    coalesce(negotiation -> 'evidence', '[]'::jsonb),
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'negotiations', '[]'::jsonb)
  ) as negotiation
  on conflict (tenant_id, rfq_id, id) do update
  set supplier_id = excluded.supplier_id,
      negotiation_round = excluded.negotiation_round,
      recorded_at = excluded.recorded_at,
      recorded_by_role = excluded.recorded_by_role,
      summary = excluded.summary,
      evidence = excluded.evidence,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_rfq_decision_notices (
    tenant_id, rfq_id, id, supplier_id, notice_type, issued_at,
    issued_by_role, summary, evidence, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id, rfq ->> 'id', notice ->> 'id',
    notice ->> 'supplierId', notice ->> 'noticeType',
    (notice ->> 'issuedAt')::timestamptz,
    notice ->> 'issuedByRole', notice ->> 'summary',
    coalesce(notice -> 'evidence', '[]'::jsonb),
    p_revision, p_command_id, true, now()
  from jsonb_array_elements(
    coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
  ) as rfq
  cross join lateral jsonb_array_elements(
    coalesce(rfq -> 'decisionNotices', '[]'::jsonb)
  ) as notice
  on conflict (tenant_id, rfq_id, id) do update
  set supplier_id = excluded.supplier_id,
      notice_type = excluded.notice_type,
      issued_at = excluded.issued_at,
      issued_by_role = excluded.issued_by_role,
      summary = excluded.summary,
      evidence = excluded.evidence,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();
end;
$$;

create or replace function private.sync_rfq_governance_from_command()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  select snapshot.state
  into v_state
  from public.procurement_demo_snapshots as snapshot
  where snapshot.tenant_id = new.tenant_id;

  perform private.sync_rfq_governance_kernel(
    new.tenant_id,
    v_state,
    new.result_revision,
    new.command_id
  );
  return new;
end;
$$;

-- The "z" suffix deliberately orders this trigger after the existing RFQ
-- parent projection trigger; PostgreSQL runs same-event triggers by name.
drop trigger if exists procurement_command_rfq_z_governance_projection
  on public.procurement_command_ledger;
create trigger procurement_command_rfq_z_governance_projection
after insert on public.procurement_command_ledger
for each row execute function private.sync_rfq_governance_from_command();

do $$
declare
  snapshot record;
begin
  for snapshot in
    select tenant_id, state, revision, last_command_id
    from public.procurement_demo_snapshots
    where last_command_id is not null
  loop
    perform private.sync_rfq_governance_kernel(
      snapshot.tenant_id,
      snapshot.state,
      snapshot.revision,
      snapshot.last_command_id
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'procurement_rfq_amendments',
    'procurement_rfq_addenda',
    'procurement_rfq_questions',
    'procurement_rfq_conflicts',
    'procurement_rfq_negotiations',
    'procurement_rfq_decision_notices'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format(
      'grant all on table public.%I to service_role',
      table_name
    );
    execute format(
      'comment on table public.%I is %L',
      table_name,
      'Server-authorized sourcing record; direct browser Data API access is revoked.'
    );
  end loop;
end
$$;

revoke all on function private.sync_rfq_governance_kernel(
  text, jsonb, bigint, uuid
) from public, anon, authenticated;
revoke all on function private.sync_rfq_governance_from_command()
  from public, anon, authenticated;

commit;
