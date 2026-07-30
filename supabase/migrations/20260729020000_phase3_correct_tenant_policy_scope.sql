begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'phase3_capability_registry',
    'phase3_dataset_versions',
    'phase3_integration_connections',
    'phase3_integration_runs',
    'phase3_contract_intelligence',
    'phase3_workflow_versions',
    'phase3_report_snapshots',
    'phase3_assurance_findings',
    'phase3_operations_records',
    'phase3_rehearsal_records',
    'phase3_release_manifests'
  ]
  loop
    execute format(
      'drop policy if exists tenant_member_read on public.%I',
      table_name
    );
    execute format(
      'create policy tenant_member_read on public.%I
        for select
        to authenticated
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

drop policy if exists tenant_or_supplier_read
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

commit;
