-- Mission Back on Track M3: normalized competitive-sourcing lifecycle.

create table if not exists public.procurement_rfqs (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  rfq_number text not null,
  request_id text not null,
  title text not null,
  description text not null,
  sourcing_method text not null check (sourcing_method in ('rfq', 'rfp')),
  lifecycle_state text not null check (
    lifecycle_state in (
      'draft', 'open', 'responses_received', 'closed', 'bafo_open',
      'evaluated', 'awarded', 'cancelled'
    )
  ),
  currency text not null check (currency = 'USD'),
  issue_date date,
  response_deadline date not null,
  sealed_until timestamptz not null,
  retention_until date not null,
  terms_version text not null,
  evaluation_version text not null,
  bafo_round integer not null check (bafo_round > 0),
  business_revision integer not null check (business_revision > 0),
  correlation_id uuid not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, rfq_number),
  foreign key (tenant_id, request_id)
    references public.procurement_requests(tenant_id, id)
);

create table if not exists public.procurement_rfq_lines (
  tenant_id text not null,
  rfq_id text not null,
  line_id text not null,
  request_line_id text not null,
  description text not null,
  quantity numeric(20, 6) not null check (quantity > 0),
  unit_of_measure text not null,
  required_by_date date not null,
  specification text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, line_id),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_rfq_suppliers (
  tenant_id text not null,
  rfq_id text not null,
  supplier_id text not null,
  supplier_organization_id text not null,
  supplier_name text not null,
  status text not null check (
    status in (
      'selected', 'invited', 'viewed', 'responded', 'declined',
      'shortlisted', 'not_awarded', 'awarded'
    )
  ),
  invited_at timestamptz,
  viewed_at timestamptz,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id, supplier_id),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_rfq_responses (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  supplier_id text not null,
  supplier_organization_id text not null,
  response_round integer not null check (response_round > 0),
  status text not null check (
    status in ('draft', 'submitted', 'withdrawn', 'revealed', 'superseded')
  ),
  submitted_at timestamptz,
  revealed_at timestamptz,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  freight_cents bigint not null check (freight_cents >= 0),
  total_cents bigint not null check (
    total_cents = subtotal_cents + freight_cents
  ),
  payment_terms text not null,
  validity_date date not null,
  attachments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attachments) = 'array'),
  response_hash text not null check (response_hash ~ '^[0-9a-f]{64}$'),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, rfq_id, supplier_id, response_round),
  foreign key (tenant_id, rfq_id, supplier_id)
    references public.procurement_rfq_suppliers(
      tenant_id, rfq_id, supplier_id
    )
);

create table if not exists public.procurement_rfq_response_lines (
  tenant_id text not null,
  response_id text not null,
  rfq_line_id text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  extended_price_cents bigint not null check (extended_price_cents >= 0),
  promised_date date not null,
  exception text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, response_id, rfq_line_id),
  foreign key (tenant_id, response_id)
    references public.procurement_rfq_responses(tenant_id, id)
      on delete cascade
);

create table if not exists public.procurement_rfq_evaluations (
  tenant_id text not null,
  rfq_id text not null,
  id text not null,
  response_id text not null,
  supplier_id text not null,
  evaluation_round integer not null check (evaluation_round > 0),
  price_score numeric(8, 2) not null check (price_score between 0 and 50),
  delivery_score numeric(8, 2) not null check (
    delivery_score between 0 and 20
  ),
  risk_score numeric(8, 2) not null check (risk_score between 0 and 20),
  service_score numeric(8, 2) not null check (
    service_score between 0 and 10
  ),
  total_score numeric(8, 2) not null check (total_score between 0 and 100),
  rank integer not null check (rank > 0),
  completed_by_role text not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array'),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, rfq_id, evaluation_round, rank),
  foreign key (tenant_id, response_id)
    references public.procurement_rfq_responses(tenant_id, id)
);

create table if not exists public.procurement_rfq_awards (
  tenant_id text not null,
  rfq_id text not null,
  supplier_id text not null,
  response_id text not null,
  awarded_by_role text not null,
  awarded_at timestamptz not null,
  rationale text not null check (length(trim(rationale)) >= 20),
  total_cents bigint not null check (total_cents >= 0),
  purchase_order_id text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rfq_id),
  foreign key (tenant_id, rfq_id)
    references public.procurement_rfqs(tenant_id, id),
  foreign key (tenant_id, response_id)
    references public.procurement_rfq_responses(tenant_id, id)
);

create index if not exists procurement_rfqs_status_deadline_idx
  on public.procurement_rfqs (
    tenant_id, lifecycle_state, response_deadline
  );
create index if not exists procurement_rfqs_request_idx
  on public.procurement_rfqs (tenant_id, request_id);
create index if not exists procurement_rfq_suppliers_org_idx
  on public.procurement_rfq_suppliers (
    tenant_id, supplier_organization_id, status
  );
create index if not exists procurement_rfq_responses_round_idx
  on public.procurement_rfq_responses (
    tenant_id, rfq_id, response_round, status
  );
create index if not exists procurement_rfq_responses_supplier_idx
  on public.procurement_rfq_responses (
    tenant_id, supplier_organization_id, status
  );
create index if not exists procurement_rfq_evaluations_rank_idx
  on public.procurement_rfq_evaluations (
    tenant_id, rfq_id, evaluation_round, rank
  );

create or replace function private.sync_procurement_rfq_kernel(
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
declare
  rfq_record jsonb;
  line_record jsonb;
  supplier_record jsonb;
  response_record jsonb;
  response_line_record jsonb;
  evaluation_record jsonb;
  award_record jsonb;
  v_subtotal bigint;
begin
  update public.procurement_rfqs
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_suppliers
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_responses
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_response_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_evaluations
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_rfq_awards
    set is_current = false
    where tenant_id = p_tenant_id;

  for rfq_record in
    select value
    from jsonb_array_elements(
      coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
    )
  loop
    insert into public.procurement_rfqs (
      tenant_id, id, rfq_number, request_id, title, description,
      sourcing_method, lifecycle_state, currency, issue_date,
      response_deadline, sealed_until, retention_until, terms_version,
      evaluation_version, bafo_round, business_revision, correlation_id,
      source_revision, last_command_id, is_current, updated_at
    )
    values (
      p_tenant_id,
      rfq_record ->> 'id',
      rfq_record ->> 'rfqNumber',
      rfq_record ->> 'requestId',
      rfq_record ->> 'title',
      rfq_record ->> 'description',
      rfq_record ->> 'sourcingMethod',
      rfq_record ->> 'lifecycleState',
      rfq_record ->> 'currency',
      nullif(rfq_record ->> 'issueDate', '')::date,
      (rfq_record ->> 'responseDeadline')::date,
      (rfq_record ->> 'sealedUntil')::timestamptz,
      (rfq_record ->> 'retentionUntil')::date,
      rfq_record ->> 'termsVersion',
      rfq_record ->> 'evaluationVersion',
      (rfq_record ->> 'bafoRound')::integer,
      (rfq_record ->> 'version')::integer,
      (rfq_record ->> 'correlationId')::uuid,
      p_revision,
      p_command_id,
      true,
      now()
    )
    on conflict (tenant_id, id) do update
    set rfq_number = excluded.rfq_number,
        request_id = excluded.request_id,
        title = excluded.title,
        description = excluded.description,
        sourcing_method = excluded.sourcing_method,
        lifecycle_state = excluded.lifecycle_state,
        currency = excluded.currency,
        issue_date = excluded.issue_date,
        response_deadline = excluded.response_deadline,
        sealed_until = excluded.sealed_until,
        retention_until = excluded.retention_until,
        terms_version = excluded.terms_version,
        evaluation_version = excluded.evaluation_version,
        bafo_round = excluded.bafo_round,
        business_revision = excluded.business_revision,
        correlation_id = excluded.correlation_id,
        source_revision = excluded.source_revision,
        last_command_id = excluded.last_command_id,
        is_current = true,
        updated_at = now();

    for line_record in
      select value
      from jsonb_array_elements(
        coalesce(rfq_record -> 'lines', '[]'::jsonb)
      )
    loop
      insert into public.procurement_rfq_lines (
        tenant_id, rfq_id, line_id, request_line_id, description,
        quantity, unit_of_measure, required_by_date, specification,
        source_revision, last_command_id, is_current, updated_at
      )
      values (
        p_tenant_id,
        rfq_record ->> 'id',
        line_record ->> 'id',
        line_record ->> 'requestLineId',
        line_record ->> 'description',
        (line_record ->> 'quantity')::numeric,
        line_record ->> 'unitOfMeasure',
        (line_record ->> 'requiredByDate')::date,
        line_record ->> 'specification',
        p_revision,
        p_command_id,
        true,
        now()
      )
      on conflict (tenant_id, rfq_id, line_id) do update
      set request_line_id = excluded.request_line_id,
          description = excluded.description,
          quantity = excluded.quantity,
          unit_of_measure = excluded.unit_of_measure,
          required_by_date = excluded.required_by_date,
          specification = excluded.specification,
          source_revision = excluded.source_revision,
          last_command_id = excluded.last_command_id,
          is_current = true,
          updated_at = now();
    end loop;

    for supplier_record in
      select value
      from jsonb_array_elements(
        coalesce(rfq_record -> 'suppliers', '[]'::jsonb)
      )
    loop
      insert into public.procurement_rfq_suppliers (
        tenant_id, rfq_id, supplier_id, supplier_organization_id,
        supplier_name, status, invited_at, viewed_at, source_revision,
        last_command_id, is_current, updated_at
      )
      values (
        p_tenant_id,
        rfq_record ->> 'id',
        supplier_record ->> 'supplierId',
        supplier_record ->> 'supplierOrganizationId',
        supplier_record ->> 'supplierName',
        supplier_record ->> 'status',
        nullif(supplier_record ->> 'invitedAt', '')::timestamptz,
        nullif(supplier_record ->> 'viewedAt', '')::timestamptz,
        p_revision,
        p_command_id,
        true,
        now()
      )
      on conflict (tenant_id, rfq_id, supplier_id) do update
      set supplier_organization_id = excluded.supplier_organization_id,
          supplier_name = excluded.supplier_name,
          status = excluded.status,
          invited_at = excluded.invited_at,
          viewed_at = excluded.viewed_at,
          source_revision = excluded.source_revision,
          last_command_id = excluded.last_command_id,
          is_current = true,
          updated_at = now();
    end loop;

    for response_record in
      select value
      from jsonb_array_elements(
        coalesce(rfq_record -> 'responses', '[]'::jsonb)
      )
    loop
      select coalesce(sum((line_item ->> 'extendedPriceCents')::bigint), 0)
      into v_subtotal
      from jsonb_array_elements(
        coalesce(response_record -> 'lines', '[]'::jsonb)
      ) as line_item;

      insert into public.procurement_rfq_responses (
        tenant_id, rfq_id, id, supplier_id, supplier_organization_id,
        response_round, status, submitted_at, revealed_at, subtotal_cents,
        freight_cents, total_cents, payment_terms, validity_date,
        attachments, response_hash, source_revision, last_command_id,
        is_current, updated_at
      )
      values (
        p_tenant_id,
        rfq_record ->> 'id',
        response_record ->> 'id',
        response_record ->> 'supplierId',
        response_record ->> 'supplierOrganizationId',
        (response_record ->> 'round')::integer,
        response_record ->> 'status',
        nullif(response_record ->> 'submittedAt', '')::timestamptz,
        nullif(response_record ->> 'revealedAt', '')::timestamptz,
        v_subtotal,
        (response_record ->> 'freightCents')::bigint,
        (response_record ->> 'totalCents')::bigint,
        response_record ->> 'paymentTerms',
        (response_record ->> 'validityDate')::date,
        coalesce(response_record -> 'attachments', '[]'::jsonb),
        response_record ->> 'responseHash',
        p_revision,
        p_command_id,
        true,
        now()
      )
      on conflict (tenant_id, id) do update
      set status = excluded.status,
          submitted_at = excluded.submitted_at,
          revealed_at = excluded.revealed_at,
          subtotal_cents = excluded.subtotal_cents,
          freight_cents = excluded.freight_cents,
          total_cents = excluded.total_cents,
          payment_terms = excluded.payment_terms,
          validity_date = excluded.validity_date,
          attachments = excluded.attachments,
          response_hash = excluded.response_hash,
          source_revision = excluded.source_revision,
          last_command_id = excluded.last_command_id,
          is_current = true,
          updated_at = now();

      for response_line_record in
        select value
        from jsonb_array_elements(
          coalesce(response_record -> 'lines', '[]'::jsonb)
        )
      loop
        insert into public.procurement_rfq_response_lines (
          tenant_id, response_id, rfq_line_id, unit_price_cents,
          extended_price_cents, promised_date, exception, source_revision,
          last_command_id, is_current, updated_at
        )
        values (
          p_tenant_id,
          response_record ->> 'id',
          response_line_record ->> 'rfqLineId',
          (response_line_record ->> 'unitPriceCents')::bigint,
          (response_line_record ->> 'extendedPriceCents')::bigint,
          (response_line_record ->> 'promisedDate')::date,
          response_line_record ->> 'exception',
          p_revision,
          p_command_id,
          true,
          now()
        )
        on conflict (tenant_id, response_id, rfq_line_id) do update
        set unit_price_cents = excluded.unit_price_cents,
            extended_price_cents = excluded.extended_price_cents,
            promised_date = excluded.promised_date,
            exception = excluded.exception,
            source_revision = excluded.source_revision,
            last_command_id = excluded.last_command_id,
            is_current = true,
            updated_at = now();
      end loop;
    end loop;

    for evaluation_record in
      select value
      from jsonb_array_elements(
        coalesce(rfq_record -> 'evaluations', '[]'::jsonb)
      )
    loop
      insert into public.procurement_rfq_evaluations (
        tenant_id, rfq_id, id, response_id, supplier_id, evaluation_round,
        price_score, delivery_score, risk_score, service_score, total_score,
        rank, completed_by_role, evidence, source_revision, last_command_id,
        is_current, updated_at
      )
      values (
        p_tenant_id,
        rfq_record ->> 'id',
        evaluation_record ->> 'id',
        evaluation_record ->> 'responseId',
        evaluation_record ->> 'supplierId',
        (evaluation_record ->> 'round')::integer,
        (evaluation_record ->> 'priceScore')::numeric,
        (evaluation_record ->> 'deliveryScore')::numeric,
        (evaluation_record ->> 'riskScore')::numeric,
        (evaluation_record ->> 'serviceScore')::numeric,
        (evaluation_record ->> 'totalScore')::numeric,
        (evaluation_record ->> 'rank')::integer,
        evaluation_record ->> 'completedByRole',
        coalesce(evaluation_record -> 'evidence', '[]'::jsonb),
        p_revision,
        p_command_id,
        true,
        now()
      )
      on conflict (tenant_id, id) do update
      set response_id = excluded.response_id,
          supplier_id = excluded.supplier_id,
          evaluation_round = excluded.evaluation_round,
          price_score = excluded.price_score,
          delivery_score = excluded.delivery_score,
          risk_score = excluded.risk_score,
          service_score = excluded.service_score,
          total_score = excluded.total_score,
          rank = excluded.rank,
          completed_by_role = excluded.completed_by_role,
          evidence = excluded.evidence,
          source_revision = excluded.source_revision,
          last_command_id = excluded.last_command_id,
          is_current = true,
          updated_at = now();
    end loop;

    award_record := rfq_record -> 'award';
    if award_record is not null and jsonb_typeof(award_record) = 'object' then
      insert into public.procurement_rfq_awards (
        tenant_id, rfq_id, supplier_id, response_id, awarded_by_role,
        awarded_at, rationale, total_cents, purchase_order_id,
        source_revision, last_command_id, is_current, updated_at
      )
      values (
        p_tenant_id,
        rfq_record ->> 'id',
        award_record ->> 'supplierId',
        award_record ->> 'responseId',
        award_record ->> 'awardedByRole',
        (award_record ->> 'awardedAt')::timestamptz,
        award_record ->> 'rationale',
        (award_record ->> 'totalCents')::bigint,
        award_record ->> 'purchaseOrderId',
        p_revision,
        p_command_id,
        true,
        now()
      )
      on conflict (tenant_id, rfq_id) do update
      set supplier_id = excluded.supplier_id,
          response_id = excluded.response_id,
          awarded_by_role = excluded.awarded_by_role,
          awarded_at = excluded.awarded_at,
          rationale = excluded.rationale,
          total_cents = excluded.total_cents,
          purchase_order_id = excluded.purchase_order_id,
          source_revision = excluded.source_revision,
          last_command_id = excluded.last_command_id,
          is_current = true,
          updated_at = now();
    end if;
  end loop;

  with projected_raw as (
    select
      'rfq'::text as entity_type,
      rfq ->> 'id' as entity_id,
      'purchase_request'::text as parent_entity_type,
      rfq ->> 'requestId' as parent_entity_id,
      rfq as record_data
    from jsonb_array_elements(
      coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
    ) as rfq
    union all
    select
      'rfq_response',
      response ->> 'id',
      'rfq',
      rfq ->> 'id',
      response
    from jsonb_array_elements(
      coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
    ) as rfq
    cross join lateral jsonb_array_elements(
      coalesce(rfq -> 'responses', '[]'::jsonb)
    ) as response
    union all
    select
      'rfq_award',
      rfq ->> 'id',
      'rfq',
      rfq ->> 'id',
      rfq -> 'award'
    from jsonb_array_elements(
      coalesce(p_state #> '{phaseThree,rfqs}', '[]'::jsonb)
    ) as rfq
    where rfq -> 'award' is not null
      and jsonb_typeof(rfq -> 'award') = 'object'
  ),
  projected as (
    select
      projected_raw.*,
      encode(
        extensions.digest(projected_raw.record_data::text, 'sha256'),
        'hex'
      ) as record_hash
    from projected_raw
    where entity_id is not null and entity_id <> ''
  ),
  changed as (
    select projected.*, previous.version_hash as previous_version_hash
    from projected
    left join lateral (
      select version_hash, record_hash
      from public.procurement_record_versions
      where tenant_id = p_tenant_id
        and entity_type = projected.entity_type
        and entity_id = projected.entity_id
      order by state_revision desc
      limit 1
    ) as previous on true
    where previous.record_hash is distinct from projected.record_hash
  ),
  inserted as (
    insert into public.procurement_record_versions (
      tenant_id, entity_type, entity_id, state_revision,
      parent_entity_type, parent_entity_id, record_data, record_hash,
      previous_version_hash, version_hash, command_id
    )
    select
      p_tenant_id,
      changed.entity_type,
      changed.entity_id,
      p_revision,
      changed.parent_entity_type,
      changed.parent_entity_id,
      changed.record_data,
      changed.record_hash,
      changed.previous_version_hash,
      encode(
        extensions.digest(
          concat_ws(
            '|', p_tenant_id, changed.entity_type, changed.entity_id,
            p_revision::text, changed.record_hash,
            coalesce(changed.previous_version_hash, ''), p_command_id::text
          ),
          'sha256'
        ),
        'hex'
      ),
      p_command_id
    from changed
    on conflict (tenant_id, entity_type, entity_id, state_revision)
      do nothing
    returning tenant_id, entity_type, entity_id, state_revision, record_hash
  )
  insert into public.procurement_record_event_links (
    tenant_id, command_id, entity_type, entity_id, state_revision, record_hash
  )
  select
    inserted.tenant_id, p_command_id, inserted.entity_type,
    inserted.entity_id, inserted.state_revision, inserted.record_hash
  from inserted
  on conflict (tenant_id, command_id, entity_type, entity_id) do nothing;
end;
$$;

create or replace function private.sync_rfq_from_command()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  select state
  into v_state
  from public.procurement_demo_snapshots
  where tenant_id = new.tenant_id;

  perform private.sync_procurement_rfq_kernel(
    new.tenant_id,
    v_state,
    new.result_revision,
    new.command_id
  );
  return new;
end;
$$;

drop trigger if exists procurement_command_rfq_projection
  on public.procurement_command_ledger;
create trigger procurement_command_rfq_projection
after insert on public.procurement_command_ledger
for each row execute function private.sync_rfq_from_command();

do $$
declare
  snapshot record;
begin
  for snapshot in
    select tenant_id, state, revision, last_command_id
    from public.procurement_demo_snapshots
    where last_command_id is not null
  loop
    perform private.sync_procurement_rfq_kernel(
      snapshot.tenant_id,
      snapshot.state,
      snapshot.revision,
      snapshot.last_command_id
    );
  end loop;
end
$$;

create or replace function public.procurement_sourcing_readiness(
  p_tenant_id text
)
returns table (
  ready boolean,
  snapshot_revision bigint,
  sourcing_revision bigint,
  rfq_count integer,
  normalized_rfq_count integer,
  mismatch_reasons text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with snapshot as (
    select state, revision
    from public.procurement_demo_snapshots
    where tenant_id = p_tenant_id
  ),
  compared as (
    select
      snapshot.revision,
      (
        select max(source_revision)
        from public.procurement_rfqs
        where tenant_id = p_tenant_id and is_current
      ) as sourcing_revision,
      jsonb_array_length(
        coalesce(snapshot.state #> '{phaseThree,rfqs}', '[]'::jsonb)
      )::integer as rfqs,
      (
        select count(*)::integer
        from public.procurement_rfqs
        where tenant_id = p_tenant_id and is_current
      ) as normalized_rfqs
    from snapshot
  )
  select
    compared.rfqs = compared.normalized_rfqs
      and (
        compared.rfqs = 0
        or compared.sourcing_revision = compared.revision
      ),
    compared.revision,
    compared.sourcing_revision,
    compared.rfqs,
    compared.normalized_rfqs,
    array_remove(array[
      case
        when compared.rfqs <> compared.normalized_rfqs
          then 'rfq_projection_count_mismatch'
      end,
      case
        when compared.rfqs > 0
          and compared.sourcing_revision is distinct from compared.revision
          then 'rfq_projection_revision_mismatch'
      end
    ], null)::text[]
  from compared;
$$;

revoke all on function private.sync_procurement_rfq_kernel(
  text, jsonb, bigint, uuid
) from public, anon, authenticated;
revoke all on function private.sync_rfq_from_command()
  from public, anon, authenticated;
revoke all on function public.procurement_sourcing_readiness(text)
  from public, anon, authenticated;
grant execute on function public.procurement_sourcing_readiness(text)
  to service_role;

create or replace function private.is_internal_tenant_member(
  p_tenant_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.tenant_assignments as assignment
      where assignment.user_id = (select auth.uid())
        and assignment.tenant_id = p_tenant_id
    )
    and not exists (
      select 1
      from public.supplier_identity_assignments as supplier_assignment
      where supplier_assignment.user_id = (select auth.uid())
        and supplier_assignment.tenant_id = p_tenant_id
        and supplier_assignment.status = 'active'
        and (
          supplier_assignment.expires_at is null
          or supplier_assignment.expires_at > now()
        )
    );
$$;

create or replace function private.is_supplier_organization_member(
  p_tenant_id text,
  p_supplier_organization_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supplier_identity_assignments as supplier_assignment
    where supplier_assignment.user_id = (select auth.uid())
      and supplier_assignment.tenant_id = p_tenant_id
      and supplier_assignment.supplier_organization_id =
        p_supplier_organization_id
      and supplier_assignment.status = 'active'
      and (
        supplier_assignment.expires_at is null
        or supplier_assignment.expires_at > now()
      )
  );
$$;

create or replace function private.can_supplier_read_rfq(
  p_tenant_id text,
  p_rfq_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.procurement_rfqs as rfq
    join public.procurement_rfq_suppliers as invitation
      on invitation.tenant_id = rfq.tenant_id
     and invitation.rfq_id = rfq.id
    where rfq.tenant_id = p_tenant_id
      and rfq.id = p_rfq_id
      and rfq.is_current
      and rfq.lifecycle_state <> 'draft'
      and invitation.is_current
      and invitation.status in (
        'invited', 'viewed', 'responded', 'shortlisted',
        'not_awarded', 'awarded'
      )
      and private.is_supplier_organization_member(
        invitation.tenant_id,
        invitation.supplier_organization_id
      )
  );
$$;

revoke all on function private.is_internal_tenant_member(text)
  from public, anon;
revoke all on function private.is_supplier_organization_member(text, text)
  from public, anon;
revoke all on function private.can_supplier_read_rfq(text, text)
  from public, anon;
grant execute on function private.is_internal_tenant_member(text)
  to authenticated;
grant execute on function private.is_supplier_organization_member(text, text)
  to authenticated;
grant execute on function private.can_supplier_read_rfq(text, text)
  to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'procurement_rfqs',
    'procurement_rfq_lines',
    'procurement_rfq_suppliers',
    'procurement_rfq_responses',
    'procurement_rfq_response_lines',
    'procurement_rfq_evaluations',
    'procurement_rfq_awards'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      table_name
    );
    execute format(
      'grant select on table public.%I to authenticated',
      table_name
    );
    execute format(
      'grant all on table public.%I to service_role',
      table_name
    );
  end loop;
end
$$;

create policy internal_rfq_read
on public.procurement_rfqs
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy supplier_invited_rfq_read
on public.procurement_rfqs
for select to authenticated
using (private.can_supplier_read_rfq(tenant_id, id));

create policy internal_rfq_line_read
on public.procurement_rfq_lines
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy supplier_invited_rfq_line_read
on public.procurement_rfq_lines
for select to authenticated
using (private.can_supplier_read_rfq(tenant_id, rfq_id));

create policy internal_rfq_supplier_read
on public.procurement_rfq_suppliers
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy own_rfq_invitation_read
on public.procurement_rfq_suppliers
for select to authenticated
using (
  private.is_supplier_organization_member(
    tenant_id, supplier_organization_id
  )
);

create policy internal_rfq_response_read
on public.procurement_rfq_responses
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy own_rfq_response_read
on public.procurement_rfq_responses
for select to authenticated
using (
  private.is_supplier_organization_member(
    tenant_id, supplier_organization_id
  )
);

create policy internal_rfq_response_line_read
on public.procurement_rfq_response_lines
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy own_rfq_response_line_read
on public.procurement_rfq_response_lines
for select to authenticated
using (
  exists (
    select 1
    from public.procurement_rfq_responses as response
    where response.tenant_id = procurement_rfq_response_lines.tenant_id
      and response.id = procurement_rfq_response_lines.response_id
      and private.is_supplier_organization_member(
        response.tenant_id,
        response.supplier_organization_id
      )
  )
);

create policy internal_rfq_evaluation_read
on public.procurement_rfq_evaluations
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy internal_rfq_award_read
on public.procurement_rfq_awards
for select to authenticated
using (private.is_internal_tenant_member(tenant_id));

create policy awarded_supplier_read
on public.procurement_rfq_awards
for select to authenticated
using (
  exists (
    select 1
    from public.procurement_rfq_suppliers as supplier
    where supplier.tenant_id = procurement_rfq_awards.tenant_id
      and supplier.rfq_id = procurement_rfq_awards.rfq_id
      and supplier.supplier_id = procurement_rfq_awards.supplier_id
      and private.is_supplier_organization_member(
        supplier.tenant_id,
        supplier.supplier_organization_id
      )
  )
);

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
