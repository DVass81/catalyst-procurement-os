begin;

-- Mission Back on Track M1 establishes a durable command ledger and a
-- normalized transactional kernel beside the legacy snapshot. The snapshot is
-- retained as a compatibility view during shadow migration; every successful
-- command updates both representations in one PostgreSQL transaction.

create table if not exists public.procurement_command_ledger (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  command_id uuid not null,
  command_type text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  command_payload jsonb not null,
  actor_id uuid references auth.users(id),
  actor_role text not null,
  expected_revision bigint not null check (expected_revision >= 0),
  result_revision bigint not null check (result_revision >= 0),
  result_checksum text not null check (result_checksum ~ '^[0-9a-f]{64}$'),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, command_id),
  unique (tenant_id, result_revision)
);

create index if not exists procurement_command_ledger_tenant_time_idx
  on public.procurement_command_ledger (tenant_id, occurred_at desc);
create index if not exists procurement_command_ledger_correlation_idx
  on public.procurement_command_ledger (tenant_id, correlation_id);
create index if not exists procurement_command_ledger_actor_idx
  on public.procurement_command_ledger (actor_id)
  where actor_id is not null;

create table if not exists public.procurement_suppliers (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  legal_name text not null,
  display_name text not null,
  category text not null,
  contract_status text not null,
  preferred boolean not null,
  risk_tier text not null,
  documentation_status text not null,
  onboarding_status text not null,
  sanctions_status text not null,
  compliance_hold boolean not null,
  total_spend_cents bigint not null check (total_spend_cents >= 0),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.procurement_budgets (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  fiscal_year text not null,
  department_id text not null,
  cost_center text not null,
  gl_account text not null,
  original_budget_cents bigint not null check (original_budget_cents >= 0),
  revised_budget_cents bigint not null check (revised_budget_cents >= 0),
  committed_cents bigint not null check (committed_cents >= 0),
  actual_spend_cents bigint not null check (actual_spend_cents >= 0),
  forecast_cents bigint not null check (forecast_cents >= 0),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.procurement_requests (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  request_number text not null,
  title text not null,
  requester_ref text not null,
  department_id text not null,
  location_id text not null,
  request_date date not null,
  required_date date not null,
  business_justification text not null,
  request_type text not null,
  status text not null,
  priority text not null,
  estimated_total_cents bigint not null check (estimated_total_cents >= 0),
  recommended_total_cents bigint not null check (recommended_total_cents >= 0),
  identified_savings_cents bigint not null check (identified_savings_cents >= 0),
  budget_status text not null,
  selected_supplier_id text,
  fields_locked boolean not null,
  business_revision integer not null check (business_revision >= 0),
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, request_number)
);

create index if not exists procurement_requests_tenant_status_idx
  on public.procurement_requests (tenant_id, status, required_date);
create index if not exists procurement_requests_supplier_idx
  on public.procurement_requests (tenant_id, selected_supplier_id)
  where selected_supplier_id is not null;

create table if not exists public.procurement_request_lines (
  tenant_id text not null,
  request_id text not null,
  line_id text not null,
  catalog_item_id text not null,
  description text not null,
  original_description text not null,
  requested_quantity numeric(20, 6) not null check (requested_quantity >= 0),
  purchase_quantity numeric(20, 6) not null check (purchase_quantity >= 0),
  inventory_quantity numeric(20, 6) not null check (inventory_quantity >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  original_unit_price_cents bigint not null check (original_unit_price_cents >= 0),
  gl_account text not null,
  standard_status text not null,
  source text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, request_id, line_id),
  foreign key (tenant_id, request_id)
    references public.procurement_requests(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_approvals (
  tenant_id text not null,
  id text not null,
  request_id text not null,
  sequence integer not null check (sequence > 0),
  approver_ref text not null,
  approver_role text not null,
  status text not null,
  assigned_date date not null,
  due_date date not null,
  completed_date date,
  decision text,
  comments text,
  delegation text,
  escalation_status text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, request_id)
    references public.procurement_requests(tenant_id, id) on delete cascade,
  unique (tenant_id, request_id, sequence)
);

create index if not exists procurement_approvals_queue_idx
  on public.procurement_approvals
    (tenant_id, approver_ref, status, due_date);

create table if not exists public.procurement_purchase_orders (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  po_number text not null,
  source_request_id text not null,
  supplier_id text not null,
  buyer_ref text not null,
  order_date date not null,
  expected_date date not null,
  delivery_location_id text not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  shipping_cents bigint not null check (shipping_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (
    total_cents = subtotal_cents + shipping_cents + tax_cents
  ),
  status text not null,
  contract_reference text,
  approval_reference text not null,
  receipt_status text not null,
  invoice_status text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, po_number),
  foreign key (tenant_id, source_request_id)
    references public.procurement_requests(tenant_id, id)
);

create index if not exists procurement_purchase_orders_status_idx
  on public.procurement_purchase_orders
    (tenant_id, status, expected_date);
create index if not exists procurement_purchase_orders_supplier_idx
  on public.procurement_purchase_orders (tenant_id, supplier_id);
create index if not exists procurement_purchase_orders_request_idx
  on public.procurement_purchase_orders (tenant_id, source_request_id);

create table if not exists public.procurement_purchase_order_lines (
  tenant_id text not null,
  purchase_order_id text not null,
  line_id text not null,
  catalog_item_id text not null,
  description text not null,
  ordered_quantity numeric(20, 6) not null check (ordered_quantity >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  gl_account text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, purchase_order_id, line_id),
  foreign key (tenant_id, purchase_order_id)
    references public.procurement_purchase_orders(tenant_id, id)
      on delete cascade
);

create table if not exists public.procurement_receipts (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  receipt_number text not null,
  purchase_order_id text not null,
  received_by_ref text not null,
  received_date date not null,
  location_id text not null,
  notes text not null,
  exception_status text not null,
  lifecycle_status text not null,
  total_value_cents bigint not null check (total_value_cents >= 0),
  carrier_reference text,
  replacement_for_receipt_id text,
  reversed_at timestamptz,
  reversal_reason text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, receipt_number),
  foreign key (tenant_id, purchase_order_id)
    references public.procurement_purchase_orders(tenant_id, id)
);

create index if not exists procurement_receipts_po_idx
  on public.procurement_receipts
    (tenant_id, purchase_order_id, received_date);

create table if not exists public.procurement_receipt_lines (
  tenant_id text not null,
  receipt_id text not null,
  line_id text not null,
  delivered_quantity numeric(20, 6) not null check (delivered_quantity >= 0),
  accepted_quantity numeric(20, 6) not null check (accepted_quantity >= 0),
  pending_inspection_quantity numeric(20, 6) not null
    check (pending_inspection_quantity >= 0),
  damaged_quantity numeric(20, 6) not null check (damaged_quantity >= 0),
  rejected_quantity numeric(20, 6) not null check (rejected_quantity >= 0),
  returned_quantity numeric(20, 6) not null check (returned_quantity >= 0),
  condition_note text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, receipt_id, line_id),
  foreign key (tenant_id, receipt_id)
    references public.procurement_receipts(tenant_id, id) on delete cascade,
  check (
    accepted_quantity + pending_inspection_quantity + rejected_quantity
      <= delivered_quantity
  ),
  check (returned_quantity <= rejected_quantity)
);

create table if not exists public.procurement_invoices (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  invoice_number text not null,
  supplier_id text not null,
  purchase_order_id text not null,
  invoice_date date not null,
  due_date date not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  shipping_cents bigint not null check (shipping_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (
    total_cents = subtotal_cents + shipping_cents + tax_cents
  ),
  match_status text not null,
  duplicate_risk text not null,
  exception_status text not null,
  approval_status text not null,
  payment_status text not null,
  variance_cents bigint not null,
  variance_reason text,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, supplier_id, invoice_number),
  foreign key (tenant_id, purchase_order_id)
    references public.procurement_purchase_orders(tenant_id, id)
);

create index if not exists procurement_invoices_status_idx
  on public.procurement_invoices
    (tenant_id, match_status, payment_status, due_date);
create index if not exists procurement_invoices_po_idx
  on public.procurement_invoices (tenant_id, purchase_order_id);

create table if not exists public.procurement_invoice_lines (
  tenant_id text not null,
  invoice_id text not null,
  line_id text not null,
  catalog_item_id text not null,
  description text not null,
  invoiced_quantity numeric(20, 6) not null check (invoiced_quantity >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  gl_account text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, invoice_id, line_id),
  foreign key (tenant_id, invoice_id)
    references public.procurement_invoices(tenant_id, id) on delete cascade
);

create table if not exists public.procurement_inventory_transactions (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  item_id text not null,
  location_id text not null,
  transaction_type text not null,
  quantity numeric(20, 6) not null,
  source_transaction_id text not null,
  transaction_date date not null,
  actor_ref text not null,
  notes text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.procurement_contracts (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  id text not null,
  supplier_id text not null,
  name text not null,
  value_cents bigint not null check (value_cents >= 0),
  start_date date not null,
  end_date date not null,
  notice_deadline date not null,
  status text not null,
  source_revision bigint not null check (source_revision >= 0),
  last_command_id uuid not null,
  is_current boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists procurement_contracts_supplier_idx
  on public.procurement_contracts
    (tenant_id, supplier_id, status, notice_deadline);

create table if not exists public.procurement_record_versions (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  state_revision bigint not null check (state_revision >= 0),
  parent_entity_type text,
  parent_entity_id text,
  record_data jsonb not null,
  record_hash text not null check (record_hash ~ '^[0-9a-f]{64}$'),
  previous_version_hash text
    check (
      previous_version_hash is null
      or previous_version_hash ~ '^[0-9a-f]{64}$'
    ),
  version_hash text not null check (version_hash ~ '^[0-9a-f]{64}$'),
  command_id uuid not null,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, entity_type, entity_id, state_revision),
  unique (tenant_id, version_hash),
  foreign key (tenant_id, command_id)
    references public.procurement_command_ledger(tenant_id, command_id)
);

create index if not exists procurement_record_versions_timeline_idx
  on public.procurement_record_versions
    (tenant_id, entity_type, entity_id, state_revision desc);
create index if not exists procurement_record_versions_command_idx
  on public.procurement_record_versions (tenant_id, command_id);

create table if not exists public.procurement_record_event_links (
  tenant_id text not null,
  command_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  state_revision bigint not null check (state_revision >= 0),
  record_hash text not null check (record_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, command_id, entity_type, entity_id),
  foreign key (tenant_id, command_id)
    references public.procurement_command_ledger(tenant_id, command_id),
  foreign key (tenant_id, entity_type, entity_id, state_revision)
    references public.procurement_record_versions(
      tenant_id, entity_type, entity_id, state_revision
  )
);

create index if not exists procurement_record_event_links_version_idx
  on public.procurement_record_event_links
    (tenant_id, entity_type, entity_id, state_revision);

create table if not exists public.procurement_projection_outbox (
  tenant_id text not null
    references public.tenant_demo_configs(tenant_id) on delete cascade,
  command_id uuid not null,
  projection_type text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  available_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, command_id, projection_type),
  foreign key (tenant_id, command_id)
    references public.procurement_command_ledger(tenant_id, command_id)
);

create index if not exists procurement_projection_outbox_pending_idx
  on public.procurement_projection_outbox
    (available_at, tenant_id, command_id)
  where status = 'pending';

create or replace function private.sync_procurement_kernel(
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
  update public.procurement_suppliers
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_budgets
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_request_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_approvals
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_purchase_order_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_receipt_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_invoice_lines
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_inventory_transactions
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_contracts
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_receipts
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_invoices
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_purchase_orders
    set is_current = false
    where tenant_id = p_tenant_id;
  update public.procurement_requests
    set is_current = false
    where tenant_id = p_tenant_id;

  insert into public.procurement_suppliers (
    tenant_id, id, legal_name, display_name, category, contract_status,
    preferred, risk_tier, documentation_status, onboarding_status,
    sanctions_status, compliance_hold, total_spend_cents, source_revision,
    last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    supplier ->> 'id',
    supplier ->> 'legalName',
    supplier ->> 'displayName',
    supplier ->> 'category',
    supplier ->> 'contractStatus',
    coalesce((supplier ->> 'preferred')::boolean, false),
    supplier ->> 'riskTier',
    supplier ->> 'documentationStatus',
    supplier ->> 'onboardingStatus',
    supplier ->> 'sanctionsStatus',
    coalesce((supplier ->> 'complianceHold')::boolean, false),
    coalesce((supplier ->> 'totalSpendCents')::bigint, 0),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'vendors', '[]'::jsonb)
  ) as supplier
  on conflict (tenant_id, id) do update
  set legal_name = excluded.legal_name,
      display_name = excluded.display_name,
      category = excluded.category,
      contract_status = excluded.contract_status,
      preferred = excluded.preferred,
      risk_tier = excluded.risk_tier,
      documentation_status = excluded.documentation_status,
      onboarding_status = excluded.onboarding_status,
      sanctions_status = excluded.sanctions_status,
      compliance_hold = excluded.compliance_hold,
      total_spend_cents = excluded.total_spend_cents,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_budgets (
    tenant_id, id, fiscal_year, department_id, cost_center, gl_account,
    original_budget_cents, revised_budget_cents, committed_cents,
    actual_spend_cents, forecast_cents, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id,
    budget ->> 'id',
    budget ->> 'fiscalYear',
    budget ->> 'departmentId',
    budget ->> 'costCenter',
    budget ->> 'glAccount',
    coalesce((budget ->> 'originalBudgetCents')::bigint, 0),
    coalesce((budget ->> 'revisedBudgetCents')::bigint, 0),
    coalesce((budget ->> 'committedCents')::bigint, 0),
    coalesce((budget ->> 'actualSpendCents')::bigint, 0),
    coalesce((budget ->> 'forecastCents')::bigint, 0),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'budgets', '[]'::jsonb)
  ) as budget
  on conflict (tenant_id, id) do update
  set fiscal_year = excluded.fiscal_year,
      department_id = excluded.department_id,
      cost_center = excluded.cost_center,
      gl_account = excluded.gl_account,
      original_budget_cents = excluded.original_budget_cents,
      revised_budget_cents = excluded.revised_budget_cents,
      committed_cents = excluded.committed_cents,
      actual_spend_cents = excluded.actual_spend_cents,
      forecast_cents = excluded.forecast_cents,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_requests (
    tenant_id, id, request_number, title, requester_ref, department_id,
    location_id, request_date, required_date, business_justification,
    request_type, status, priority, estimated_total_cents,
    recommended_total_cents, identified_savings_cents, budget_status,
    selected_supplier_id, fields_locked, business_revision, source_revision,
    last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    request_record ->> 'id',
    request_record ->> 'requestNumber',
    request_record ->> 'title',
    request_record ->> 'requesterId',
    request_record ->> 'departmentId',
    request_record ->> 'locationId',
    (request_record ->> 'requestDate')::date,
    (request_record ->> 'requiredDate')::date,
    request_record ->> 'businessJustification',
    request_record ->> 'requestType',
    request_record ->> 'status',
    request_record ->> 'priority',
    coalesce((request_record ->> 'estimatedTotalCents')::bigint, 0),
    coalesce((request_record ->> 'recommendedTotalCents')::bigint, 0),
    coalesce((request_record ->> 'identifiedSavingsCents')::bigint, 0),
    request_record ->> 'budgetStatus',
    nullif(request_record ->> 'selectedVendorId', ''),
    coalesce((request_record ->> 'fieldsLocked')::boolean, false),
    coalesce((request_record ->> 'revision')::integer, 0),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'requests', '[]'::jsonb)
  ) as request_record
  on conflict (tenant_id, id) do update
  set request_number = excluded.request_number,
      title = excluded.title,
      requester_ref = excluded.requester_ref,
      department_id = excluded.department_id,
      location_id = excluded.location_id,
      request_date = excluded.request_date,
      required_date = excluded.required_date,
      business_justification = excluded.business_justification,
      request_type = excluded.request_type,
      status = excluded.status,
      priority = excluded.priority,
      estimated_total_cents = excluded.estimated_total_cents,
      recommended_total_cents = excluded.recommended_total_cents,
      identified_savings_cents = excluded.identified_savings_cents,
      budget_status = excluded.budget_status,
      selected_supplier_id = excluded.selected_supplier_id,
      fields_locked = excluded.fields_locked,
      business_revision = excluded.business_revision,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_request_lines (
    tenant_id, request_id, line_id, catalog_item_id, description,
    original_description, requested_quantity, purchase_quantity,
    inventory_quantity, unit_price_cents, original_unit_price_cents,
    gl_account, standard_status, source, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id,
    request_record ->> 'id',
    line_record ->> 'id',
    line_record ->> 'catalogItemId',
    line_record ->> 'description',
    line_record ->> 'originalDescription',
    coalesce((line_record ->> 'requestedQuantity')::numeric, 0),
    coalesce((line_record ->> 'purchaseQuantity')::numeric, 0),
    coalesce((line_record ->> 'inventoryQuantity')::numeric, 0),
    coalesce((line_record ->> 'unitPriceCents')::bigint, 0),
    coalesce((line_record ->> 'originalUnitPriceCents')::bigint, 0),
    line_record ->> 'glAccount',
    line_record ->> 'standardStatus',
    line_record ->> 'source',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'requests', '[]'::jsonb)
  ) as request_record
  cross join lateral jsonb_array_elements(
    coalesce(request_record -> 'lines', '[]'::jsonb)
  ) as line_record
  on conflict (tenant_id, request_id, line_id) do update
  set catalog_item_id = excluded.catalog_item_id,
      description = excluded.description,
      original_description = excluded.original_description,
      requested_quantity = excluded.requested_quantity,
      purchase_quantity = excluded.purchase_quantity,
      inventory_quantity = excluded.inventory_quantity,
      unit_price_cents = excluded.unit_price_cents,
      original_unit_price_cents = excluded.original_unit_price_cents,
      gl_account = excluded.gl_account,
      standard_status = excluded.standard_status,
      source = excluded.source,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_approvals (
    tenant_id, id, request_id, sequence, approver_ref, approver_role, status,
    assigned_date, due_date, completed_date, decision, comments, delegation,
    escalation_status, source_revision, last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    approval ->> 'id',
    approval ->> 'requestId',
    (approval ->> 'sequence')::integer,
    approval ->> 'approverId',
    approval ->> 'role',
    approval ->> 'status',
    (approval ->> 'assignedDate')::date,
    (approval ->> 'dueDate')::date,
    nullif(approval ->> 'completedDate', '')::date,
    nullif(approval ->> 'decision', ''),
    nullif(approval ->> 'comments', ''),
    nullif(approval ->> 'delegation', ''),
    approval ->> 'escalationStatus',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'approvals', '[]'::jsonb)
  ) as approval
  on conflict (tenant_id, id) do update
  set request_id = excluded.request_id,
      sequence = excluded.sequence,
      approver_ref = excluded.approver_ref,
      approver_role = excluded.approver_role,
      status = excluded.status,
      assigned_date = excluded.assigned_date,
      due_date = excluded.due_date,
      completed_date = excluded.completed_date,
      decision = excluded.decision,
      comments = excluded.comments,
      delegation = excluded.delegation,
      escalation_status = excluded.escalation_status,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_purchase_orders (
    tenant_id, id, po_number, source_request_id, supplier_id, buyer_ref,
    order_date, expected_date, delivery_location_id, subtotal_cents,
    shipping_cents, tax_cents, total_cents, status, contract_reference,
    approval_reference, receipt_status, invoice_status, source_revision,
    last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    purchase_order ->> 'id',
    purchase_order ->> 'poNumber',
    purchase_order ->> 'sourceRequestId',
    purchase_order ->> 'vendorId',
    purchase_order ->> 'buyerId',
    (purchase_order ->> 'orderDate')::date,
    (purchase_order ->> 'expectedDate')::date,
    purchase_order ->> 'deliveryLocationId',
    coalesce((purchase_order ->> 'subtotalCents')::bigint, 0),
    coalesce((purchase_order ->> 'shippingCents')::bigint, 0),
    coalesce((purchase_order ->> 'taxCents')::bigint, 0),
    coalesce((purchase_order ->> 'totalCents')::bigint, 0),
    purchase_order ->> 'status',
    nullif(purchase_order ->> 'contractReference', ''),
    purchase_order ->> 'approvalReference',
    purchase_order ->> 'receiptStatus',
    purchase_order ->> 'invoiceStatus',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'purchaseOrders', '[]'::jsonb)
  ) as purchase_order
  on conflict (tenant_id, id) do update
  set po_number = excluded.po_number,
      source_request_id = excluded.source_request_id,
      supplier_id = excluded.supplier_id,
      buyer_ref = excluded.buyer_ref,
      order_date = excluded.order_date,
      expected_date = excluded.expected_date,
      delivery_location_id = excluded.delivery_location_id,
      subtotal_cents = excluded.subtotal_cents,
      shipping_cents = excluded.shipping_cents,
      tax_cents = excluded.tax_cents,
      total_cents = excluded.total_cents,
      status = excluded.status,
      contract_reference = excluded.contract_reference,
      approval_reference = excluded.approval_reference,
      receipt_status = excluded.receipt_status,
      invoice_status = excluded.invoice_status,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_purchase_order_lines (
    tenant_id, purchase_order_id, line_id, catalog_item_id, description,
    ordered_quantity, unit_price_cents, gl_account, source_revision,
    last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    purchase_order ->> 'id',
    line_record ->> 'id',
    line_record ->> 'catalogItemId',
    line_record ->> 'description',
    coalesce((line_record ->> 'purchaseQuantity')::numeric, 0),
    coalesce((line_record ->> 'unitPriceCents')::bigint, 0),
    line_record ->> 'glAccount',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'purchaseOrders', '[]'::jsonb)
  ) as purchase_order
  cross join lateral jsonb_array_elements(
    coalesce(purchase_order -> 'lines', '[]'::jsonb)
  ) as line_record
  on conflict (tenant_id, purchase_order_id, line_id) do update
  set catalog_item_id = excluded.catalog_item_id,
      description = excluded.description,
      ordered_quantity = excluded.ordered_quantity,
      unit_price_cents = excluded.unit_price_cents,
      gl_account = excluded.gl_account,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_receipts (
    tenant_id, id, receipt_number, purchase_order_id, received_by_ref,
    received_date, location_id, notes, exception_status, lifecycle_status,
    total_value_cents, carrier_reference, replacement_for_receipt_id,
    reversed_at, reversal_reason, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id,
    receipt ->> 'id',
    receipt ->> 'receiptNumber',
    receipt ->> 'purchaseOrderId',
    receipt ->> 'receivedBy',
    (receipt ->> 'receivedDate')::date,
    receipt ->> 'locationId',
    coalesce(receipt ->> 'notes', ''),
    receipt ->> 'exceptionStatus',
    receipt ->> 'lifecycleStatus',
    coalesce((receipt ->> 'totalValueCents')::bigint, 0),
    nullif(receipt ->> 'carrierReference', ''),
    nullif(receipt ->> 'replacementForReceiptId', ''),
    nullif(receipt ->> 'reversedAt', '')::timestamptz,
    nullif(receipt ->> 'reversalReason', ''),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'receipts', '[]'::jsonb)
  ) as receipt
  on conflict (tenant_id, id) do update
  set receipt_number = excluded.receipt_number,
      purchase_order_id = excluded.purchase_order_id,
      received_by_ref = excluded.received_by_ref,
      received_date = excluded.received_date,
      location_id = excluded.location_id,
      notes = excluded.notes,
      exception_status = excluded.exception_status,
      lifecycle_status = excluded.lifecycle_status,
      total_value_cents = excluded.total_value_cents,
      carrier_reference = excluded.carrier_reference,
      replacement_for_receipt_id = excluded.replacement_for_receipt_id,
      reversed_at = excluded.reversed_at,
      reversal_reason = excluded.reversal_reason,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_receipt_lines (
    tenant_id, receipt_id, line_id, delivered_quantity, accepted_quantity,
    pending_inspection_quantity, damaged_quantity, rejected_quantity,
    returned_quantity, condition_note, source_revision, last_command_id,
    is_current, updated_at
  )
  select
    p_tenant_id,
    receipt ->> 'id',
    line_record ->> 'lineId',
    coalesce((line_record ->> 'quantity')::numeric, 0),
    coalesce((line_record ->> 'acceptedQuantity')::numeric, 0),
    coalesce((line_record ->> 'pendingInspectionQuantity')::numeric, 0),
    coalesce((line_record ->> 'damagedQuantity')::numeric, 0),
    coalesce((line_record ->> 'rejectedQuantity')::numeric, 0),
    coalesce((line_record ->> 'returnedQuantity')::numeric, 0),
    nullif(line_record ->> 'conditionNote', ''),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'receipts', '[]'::jsonb)
  ) as receipt
  cross join lateral jsonb_array_elements(
    coalesce(receipt -> 'lines', '[]'::jsonb)
  ) as line_record
  on conflict (tenant_id, receipt_id, line_id) do update
  set delivered_quantity = excluded.delivered_quantity,
      accepted_quantity = excluded.accepted_quantity,
      pending_inspection_quantity = excluded.pending_inspection_quantity,
      damaged_quantity = excluded.damaged_quantity,
      rejected_quantity = excluded.rejected_quantity,
      returned_quantity = excluded.returned_quantity,
      condition_note = excluded.condition_note,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_invoices (
    tenant_id, id, invoice_number, supplier_id, purchase_order_id,
    invoice_date, due_date, subtotal_cents, shipping_cents, tax_cents,
    total_cents, match_status, duplicate_risk, exception_status,
    approval_status, payment_status, variance_cents, variance_reason,
    source_revision, last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    invoice ->> 'id',
    invoice ->> 'invoiceNumber',
    invoice ->> 'vendorId',
    invoice ->> 'purchaseOrderId',
    (invoice ->> 'invoiceDate')::date,
    (invoice ->> 'dueDate')::date,
    coalesce((invoice ->> 'subtotalCents')::bigint, 0),
    coalesce((invoice ->> 'shippingCents')::bigint, 0),
    coalesce((invoice ->> 'taxCents')::bigint, 0),
    coalesce((invoice ->> 'totalCents')::bigint, 0),
    invoice ->> 'matchStatus',
    invoice ->> 'duplicateRisk',
    invoice ->> 'exceptionStatus',
    invoice ->> 'approvalStatus',
    invoice ->> 'paymentStatus',
    coalesce((invoice ->> 'varianceCents')::bigint, 0),
    nullif(invoice ->> 'varianceReason', ''),
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'invoices', '[]'::jsonb)
  ) as invoice
  on conflict (tenant_id, id) do update
  set invoice_number = excluded.invoice_number,
      supplier_id = excluded.supplier_id,
      purchase_order_id = excluded.purchase_order_id,
      invoice_date = excluded.invoice_date,
      due_date = excluded.due_date,
      subtotal_cents = excluded.subtotal_cents,
      shipping_cents = excluded.shipping_cents,
      tax_cents = excluded.tax_cents,
      total_cents = excluded.total_cents,
      match_status = excluded.match_status,
      duplicate_risk = excluded.duplicate_risk,
      exception_status = excluded.exception_status,
      approval_status = excluded.approval_status,
      payment_status = excluded.payment_status,
      variance_cents = excluded.variance_cents,
      variance_reason = excluded.variance_reason,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_invoice_lines (
    tenant_id, invoice_id, line_id, catalog_item_id, description,
    invoiced_quantity, unit_price_cents, gl_account, source_revision,
    last_command_id, is_current, updated_at
  )
  select
    p_tenant_id,
    invoice ->> 'id',
    line_record ->> 'id',
    line_record ->> 'catalogItemId',
    line_record ->> 'description',
    coalesce((line_record ->> 'purchaseQuantity')::numeric, 0),
    coalesce((line_record ->> 'unitPriceCents')::bigint, 0),
    line_record ->> 'glAccount',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'invoices', '[]'::jsonb)
  ) as invoice
  cross join lateral jsonb_array_elements(
    coalesce(invoice -> 'lines', '[]'::jsonb)
  ) as line_record
  on conflict (tenant_id, invoice_id, line_id) do update
  set catalog_item_id = excluded.catalog_item_id,
      description = excluded.description,
      invoiced_quantity = excluded.invoiced_quantity,
      unit_price_cents = excluded.unit_price_cents,
      gl_account = excluded.gl_account,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  insert into public.procurement_inventory_transactions (
    tenant_id, id, item_id, location_id, transaction_type, quantity,
    source_transaction_id, transaction_date, actor_ref, notes,
    source_revision, last_command_id, is_current
  )
  select
    p_tenant_id,
    transaction_record ->> 'id',
    transaction_record ->> 'itemId',
    transaction_record ->> 'locationId',
    transaction_record ->> 'type',
    coalesce((transaction_record ->> 'quantity')::numeric, 0),
    transaction_record ->> 'sourceTransactionId',
    (transaction_record ->> 'date')::date,
    transaction_record ->> 'userId',
    transaction_record ->> 'notes',
    p_revision,
    p_command_id,
    true
  from jsonb_array_elements(
    coalesce(p_state -> 'inventoryTransactions', '[]'::jsonb)
  ) as transaction_record
  on conflict (tenant_id, id) do update
  set item_id = excluded.item_id,
      location_id = excluded.location_id,
      transaction_type = excluded.transaction_type,
      quantity = excluded.quantity,
      source_transaction_id = excluded.source_transaction_id,
      transaction_date = excluded.transaction_date,
      actor_ref = excluded.actor_ref,
      notes = excluded.notes,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true;

  insert into public.procurement_contracts (
    tenant_id, id, supplier_id, name, value_cents, start_date, end_date,
    notice_deadline, status, source_revision, last_command_id, is_current,
    updated_at
  )
  select
    p_tenant_id,
    contract_record ->> 'id',
    contract_record ->> 'vendorId',
    contract_record ->> 'name',
    coalesce((contract_record ->> 'valueCents')::bigint, 0),
    (contract_record ->> 'startDate')::date,
    (contract_record ->> 'endDate')::date,
    (contract_record ->> 'noticeDeadline')::date,
    contract_record ->> 'status',
    p_revision,
    p_command_id,
    true,
    now()
  from jsonb_array_elements(
    coalesce(p_state -> 'contracts', '[]'::jsonb)
  ) as contract_record
  on conflict (tenant_id, id) do update
  set supplier_id = excluded.supplier_id,
      name = excluded.name,
      value_cents = excluded.value_cents,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      notice_deadline = excluded.notice_deadline,
      status = excluded.status,
      source_revision = excluded.source_revision,
      last_command_id = excluded.last_command_id,
      is_current = true,
      updated_at = now();

  with projected_raw as (
    select
      'supplier'::text as entity_type,
      supplier ->> 'id' as entity_id,
      null::text as parent_entity_type,
      null::text as parent_entity_id,
      supplier as record_data
    from jsonb_array_elements(
      coalesce(p_state -> 'vendors', '[]'::jsonb)
    ) as supplier
    union all
    select
      'budget',
      budget ->> 'id',
      null,
      null,
      budget
    from jsonb_array_elements(
      coalesce(p_state -> 'budgets', '[]'::jsonb)
    ) as budget
    union all
    select
      'purchase_request',
      request_record ->> 'id',
      null,
      null,
      request_record
    from jsonb_array_elements(
      coalesce(p_state -> 'requests', '[]'::jsonb)
    ) as request_record
    union all
    select
      'request_line',
      (request_record ->> 'id') || ':' || (line_record ->> 'id'),
      'purchase_request',
      request_record ->> 'id',
      line_record
    from jsonb_array_elements(
      coalesce(p_state -> 'requests', '[]'::jsonb)
    ) as request_record
    cross join lateral jsonb_array_elements(
      coalesce(request_record -> 'lines', '[]'::jsonb)
    ) as line_record
    union all
    select
      'approval',
      approval ->> 'id',
      'purchase_request',
      approval ->> 'requestId',
      approval
    from jsonb_array_elements(
      coalesce(p_state -> 'approvals', '[]'::jsonb)
    ) as approval
    union all
    select
      'purchase_order',
      purchase_order ->> 'id',
      'purchase_request',
      purchase_order ->> 'sourceRequestId',
      purchase_order
    from jsonb_array_elements(
      coalesce(p_state -> 'purchaseOrders', '[]'::jsonb)
    ) as purchase_order
    union all
    select
      'receipt',
      receipt ->> 'id',
      'purchase_order',
      receipt ->> 'purchaseOrderId',
      receipt
    from jsonb_array_elements(
      coalesce(p_state -> 'receipts', '[]'::jsonb)
    ) as receipt
    union all
    select
      'invoice',
      invoice ->> 'id',
      'purchase_order',
      invoice ->> 'purchaseOrderId',
      invoice
    from jsonb_array_elements(
      coalesce(p_state -> 'invoices', '[]'::jsonb)
    ) as invoice
    union all
    select
      'inventory_transaction',
      transaction_record ->> 'id',
      null,
      null,
      transaction_record
    from jsonb_array_elements(
      coalesce(p_state -> 'inventoryTransactions', '[]'::jsonb)
    ) as transaction_record
    union all
    select
      'contract',
      contract_record ->> 'id',
      'supplier',
      contract_record ->> 'vendorId',
      contract_record
    from jsonb_array_elements(
      coalesce(p_state -> 'contracts', '[]'::jsonb)
    ) as contract_record
  ),
  projected as (
    select
      projected_raw.*,
      encode(
        extensions.digest(projected_raw.record_data::text, 'sha256'),
        'hex'
      ) as record_hash
    from projected_raw
    where entity_id is not null
      and entity_id <> ''
  ),
  changed as (
    select
      projected.*,
      previous.version_hash as previous_version_hash
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
            '|',
            p_tenant_id,
            changed.entity_type,
            changed.entity_id,
            p_revision::text,
            changed.record_hash,
            coalesce(changed.previous_version_hash, ''),
            p_command_id::text
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
    inserted.tenant_id,
    p_command_id,
    inserted.entity_type,
    inserted.entity_id,
    inserted.state_revision,
    inserted.record_hash
  from inserted
  on conflict do nothing;
end;
$$;

revoke all on function private.sync_procurement_kernel(
  text, jsonb, bigint, uuid
) from public, anon, authenticated;
grant execute on function private.sync_procurement_kernel(
  text, jsonb, bigint, uuid
) to service_role;

create or replace function private.initialize_procurement_kernel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bootstrap_command_id uuid := extensions.gen_random_uuid();
begin
  insert into public.procurement_command_ledger (
    tenant_id, command_id, command_type, request_hash, command_payload,
    actor_id, actor_role, expected_revision, result_revision,
    result_checksum, correlation_id
  )
  values (
    new.tenant_id,
    bootstrap_command_id,
    'kernel_bootstrap',
    encode(
      extensions.digest(
        concat_ws(
          '|',
          'kernel_bootstrap',
          new.tenant_id,
          new.revision::text,
          new.state_checksum
        ),
        'sha256'
      ),
      'hex'
    ),
    jsonb_build_object(
      'type', 'kernel_bootstrap',
      'reason', 'Normalized transaction kernel initialized',
      'simulation', true,
      'truthStatus', 'Functional Demo',
      'correlationId', bootstrap_command_id
    ),
    new.updated_by,
    'system',
    new.revision,
    new.revision,
    new.state_checksum,
    bootstrap_command_id
  );

  perform private.sync_procurement_kernel(
    new.tenant_id,
    new.state,
    new.revision,
    bootstrap_command_id
  );
  return new;
end;
$$;

revoke all on function private.initialize_procurement_kernel()
  from public, anon, authenticated;

drop trigger if exists initialize_procurement_kernel
  on public.procurement_demo_snapshots;
create trigger initialize_procurement_kernel
after insert on public.procurement_demo_snapshots
for each row execute function private.initialize_procurement_kernel();

-- Preserve the existing workflow history in the durable idempotency ledger.
insert into public.procurement_command_ledger (
  tenant_id, command_id, command_type, request_hash, command_payload,
  actor_id, actor_role, expected_revision, result_revision, result_checksum,
  correlation_id, occurred_at
)
select
  event.tenant_id,
  event.command_id,
  event.command_type,
  encode(
    extensions.digest(
      concat_ws(
        '|',
        event.command_type,
        event.command_payload::text,
        greatest(event.state_revision - 1, 0)::text
      ),
      'sha256'
    ),
    'hex'
  ),
  event.command_payload,
  event.actor_id,
  event.actor_role,
  greatest(event.state_revision - 1, 0),
  event.state_revision,
  event.state_checksum,
  coalesce(event.correlation_id, event.command_id),
  event.occurred_at
from public.procurement_workflow_events as event
on conflict (tenant_id, command_id) do nothing;

-- Revision-zero tenants have no workflow event. Add an auditable projection
-- bootstrap command without changing the compatibility snapshot's revision.
insert into public.procurement_command_ledger (
  tenant_id, command_id, command_type, request_hash, command_payload,
  actor_id, actor_role, expected_revision, result_revision, result_checksum,
  correlation_id
)
select
  snapshot.tenant_id,
  bootstrap.command_id,
  'kernel_bootstrap',
  encode(
    extensions.digest(
      concat_ws(
        '|',
        'kernel_bootstrap',
        snapshot.tenant_id,
        snapshot.revision::text,
        snapshot.state_checksum
      ),
      'sha256'
    ),
    'hex'
  ),
  jsonb_build_object(
    'type', 'kernel_bootstrap',
    'reason', 'Mission Back on Track normalized-kernel bootstrap',
    'simulation', true,
    'truthStatus', 'Functional Demo',
    'correlationId', bootstrap.command_id
  ),
  snapshot.updated_by,
  'system',
  snapshot.revision,
  snapshot.revision,
  snapshot.state_checksum,
  bootstrap.command_id
from public.procurement_demo_snapshots as snapshot
cross join lateral (
  select coalesce(
    snapshot.last_command_id,
    extensions.gen_random_uuid()
  ) as command_id
) as bootstrap
where not exists (
  select 1
  from public.procurement_command_ledger as existing
  where existing.tenant_id = snapshot.tenant_id
    and existing.result_revision = snapshot.revision
)
on conflict (tenant_id, command_id) do nothing;

do $$
declare
  snapshot public.procurement_demo_snapshots%rowtype;
  bootstrap_command_id uuid;
begin
  for snapshot in
    select * from public.procurement_demo_snapshots
  loop
    select command_id
      into bootstrap_command_id
      from public.procurement_command_ledger
      where tenant_id = snapshot.tenant_id
        and result_revision = snapshot.revision
      order by occurred_at desc
      limit 1;

    perform private.sync_procurement_kernel(
      snapshot.tenant_id,
      snapshot.state,
      snapshot.revision,
      bootstrap_command_id
    );
  end loop;
end
$$;

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
  v_existing public.procurement_command_ledger%rowtype;
  v_previous_hash text;
  v_next_revision bigint;
  v_event_hash text;
  v_request_hash text;
  v_correlation_id uuid;
  v_requested_correlation text;
begin
  if p_state_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_STATE_CHECKSUM';
  end if;

  select *
    into v_current
    from public.procurement_demo_snapshots
    where tenant_id = p_tenant_id
    for update;

  if not found then
    raise exception 'STATE_NOT_INITIALIZED';
  end if;

  v_request_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_command_type,
        p_command::text,
        p_expected_revision::text
      ),
      'sha256'
    ),
    'hex'
  );

  select *
    into v_existing
    from public.procurement_command_ledger
    where tenant_id = p_tenant_id
      and command_id = p_command_id;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
      select v_current.state, v_current.revision, p_command_id, true;
    return;
  end if;

  if not exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = p_actor_id
      and assignment.tenant_id = p_tenant_id
      and assignment.role = p_actor_role
  ) then
    raise exception 'COMMAND_AUTHORITY_DENIED';
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

  v_requested_correlation := p_command ->> 'correlationId';
  v_correlation_id := case
    when v_requested_correlation
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then v_requested_correlation::uuid
    else p_command_id
  end;

  update public.procurement_demo_snapshots
    set state = p_next_state,
        revision = v_next_revision,
        state_checksum = p_state_checksum,
        last_command_id = p_command_id,
        updated_by = p_actor_id,
        updated_at = now()
    where tenant_id = p_tenant_id;

  insert into public.procurement_workflow_events (
    tenant_id, command_id, command_type, command_payload, actor_id,
    actor_role, state_revision, state_checksum, previous_event_hash,
    event_hash
  )
  values (
    p_tenant_id, p_command_id, p_command_type, p_command, p_actor_id,
    p_actor_role, v_next_revision, p_state_checksum, v_previous_hash,
    v_event_hash
  );

  insert into public.procurement_command_ledger (
    tenant_id, command_id, command_type, request_hash, command_payload,
    actor_id, actor_role, expected_revision, result_revision,
    result_checksum, correlation_id
  )
  values (
    p_tenant_id, p_command_id, p_command_type, v_request_hash, p_command,
    p_actor_id, p_actor_role, p_expected_revision, v_next_revision,
    p_state_checksum, v_correlation_id
  );

  perform private.sync_procurement_kernel(
    p_tenant_id,
    p_next_state,
    v_next_revision,
    p_command_id
  );

  if p_command_type like 'phase3_%' then
    insert into public.procurement_projection_outbox (
      tenant_id, command_id, projection_type, payload
    )
    values (
      p_tenant_id,
      p_command_id,
      'phase3_registry',
      p_next_state -> 'phaseThree'
    )
    on conflict (tenant_id, command_id, projection_type) do nothing;
  end if;

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

create or replace function public.procurement_kernel_readiness(
  p_tenant_id text
)
returns table (
  ready boolean,
  snapshot_revision bigint,
  ledger_revision bigint,
  request_count integer,
  normalized_request_count integer,
  approval_count integer,
  normalized_approval_count integer,
  purchase_order_count integer,
  normalized_purchase_order_count integer,
  receipt_count integer,
  normalized_receipt_count integer,
  invoice_count integer,
  normalized_invoice_count integer,
  mismatch_reasons text[]
)
language sql
security invoker
set search_path = ''
as $$
  with snapshot as (
    select
      state,
      revision,
      jsonb_array_length(coalesce(state -> 'requests', '[]'::jsonb)) as requests,
      jsonb_array_length(coalesce(state -> 'approvals', '[]'::jsonb)) as approvals,
      jsonb_array_length(coalesce(state -> 'purchaseOrders', '[]'::jsonb)) as purchase_orders,
      jsonb_array_length(coalesce(state -> 'receipts', '[]'::jsonb)) as receipts,
      jsonb_array_length(coalesce(state -> 'invoices', '[]'::jsonb)) as invoices
    from public.procurement_demo_snapshots
    where tenant_id = p_tenant_id
  ),
  counts as (
    select
      (select max(result_revision)
       from public.procurement_command_ledger
       where tenant_id = p_tenant_id) as ledger_revision,
      (select count(*)::integer
       from public.procurement_requests
       where tenant_id = p_tenant_id and is_current) as requests,
      (select count(*)::integer
       from public.procurement_approvals
       where tenant_id = p_tenant_id and is_current) as approvals,
      (select count(*)::integer
       from public.procurement_purchase_orders
       where tenant_id = p_tenant_id and is_current) as purchase_orders,
      (select count(*)::integer
       from public.procurement_receipts
       where tenant_id = p_tenant_id and is_current) as receipts,
      (select count(*)::integer
       from public.procurement_invoices
       where tenant_id = p_tenant_id and is_current) as invoices
  ),
  compared as (
    select
      snapshot.*,
      counts.ledger_revision,
      counts.requests as normalized_requests,
      counts.approvals as normalized_approvals,
      counts.purchase_orders as normalized_purchase_orders,
      counts.receipts as normalized_receipts,
      counts.invoices as normalized_invoices,
      array_remove(array[
        case when counts.ledger_revision is distinct from snapshot.revision
          then 'command_ledger_revision_mismatch' end,
        case when counts.requests <> snapshot.requests
          then 'request_count_mismatch' end,
        case when counts.approvals <> snapshot.approvals
          then 'approval_count_mismatch' end,
        case when counts.purchase_orders <> snapshot.purchase_orders
          then 'purchase_order_count_mismatch' end,
        case when counts.receipts <> snapshot.receipts
          then 'receipt_count_mismatch' end,
        case when counts.invoices <> snapshot.invoices
          then 'invoice_count_mismatch' end
      ]::text[], null) as mismatches
    from snapshot
    cross join counts
  )
  select
    cardinality(compared.mismatches) = 0,
    compared.revision,
    compared.ledger_revision,
    compared.requests,
    compared.normalized_requests,
    compared.approvals,
    compared.normalized_approvals,
    compared.purchase_orders,
    compared.normalized_purchase_orders,
    compared.receipts,
    compared.normalized_receipts,
    compared.invoices,
    compared.normalized_invoices,
    compared.mismatches
  from compared;
$$;

revoke all on function public.procurement_kernel_readiness(text)
  from public, anon, authenticated;
grant execute on function public.procurement_kernel_readiness(text)
  to service_role;

create or replace function private.prevent_procurement_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PROCUREMENT_EVIDENCE_IS_APPEND_ONLY';
end;
$$;

revoke all on function private.prevent_procurement_evidence_mutation()
  from public, anon, authenticated;

drop trigger if exists procurement_command_ledger_append_only
  on public.procurement_command_ledger;
create trigger procurement_command_ledger_append_only
before update or delete on public.procurement_command_ledger
for each row execute function private.prevent_procurement_evidence_mutation();

drop trigger if exists procurement_record_versions_append_only
  on public.procurement_record_versions;
create trigger procurement_record_versions_append_only
before update or delete on public.procurement_record_versions
for each row execute function private.prevent_procurement_evidence_mutation();

drop trigger if exists procurement_record_event_links_append_only
  on public.procurement_record_event_links;
create trigger procurement_record_event_links_append_only
before update or delete on public.procurement_record_event_links
for each row execute function private.prevent_procurement_evidence_mutation();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'procurement_command_ledger',
    'procurement_suppliers',
    'procurement_budgets',
    'procurement_requests',
    'procurement_request_lines',
    'procurement_approvals',
    'procurement_purchase_orders',
    'procurement_purchase_order_lines',
    'procurement_receipts',
    'procurement_receipt_lines',
    'procurement_invoices',
    'procurement_invoice_lines',
    'procurement_inventory_transactions',
    'procurement_contracts',
    'procurement_record_versions',
    'procurement_record_event_links',
    'procurement_projection_outbox'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
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
    execute format(
      'drop policy if exists tenant_member_read on public.%I',
      table_name
    );
    execute format(
      'create policy tenant_member_read on public.%I
       for select to authenticated
       using (
         exists (
           select 1
           from public.tenant_assignments as assignment
           where assignment.user_id = (select auth.uid())
             and assignment.tenant_id = %I.tenant_id
         )
       )',
      table_name,
      table_name
    );
  end loop;
end
$$;

grant usage, select on all sequences in schema public to service_role;

commit;
