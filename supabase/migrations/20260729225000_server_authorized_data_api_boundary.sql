begin;

-- Operational and evidence records are exposed to users only through
-- server-authorized interfaces. RLS remains enabled as defense in depth, but
-- authenticated browser clients receive no direct table privilege that could
-- bypass active-role, supplier-scope, assurance, or export checks.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'procurement_demo_snapshots',
    'procurement_workflow_events',
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
    'procurement_projection_outbox',
    'procurement_rfqs',
    'procurement_rfq_lines',
    'procurement_rfq_suppliers',
    'procurement_rfq_responses',
    'procurement_rfq_response_lines',
    'procurement_rfq_evaluations',
    'procurement_rfq_awards',
    'procurement_approval_delegation_versions',
    'phase3_capability_registry',
    'phase3_dataset_versions',
    'phase3_integration_connections',
    'phase3_integration_runs',
    'phase3_supplier_applications',
    'phase3_contract_intelligence',
    'phase3_workflow_versions',
    'phase3_report_snapshots',
    'phase3_report_schedules',
    'phase3_report_deliveries',
    'phase3_assurance_findings',
    'phase3_operations_records',
    'phase3_rehearsal_records',
    'phase3_release_manifests',
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
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'SERVER_AUTHORIZED_TABLE_MISSING:%', table_name;
    end if;
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      table_name
    );
    execute format(
      'grant all on table public.%I to service_role',
      table_name
    );
    execute format(
      'comment on table public.%I is %L',
      table_name,
      'Server-authorized operational data; direct browser Data API access is revoked.'
    );
  end loop;
end
$$;

commit;
