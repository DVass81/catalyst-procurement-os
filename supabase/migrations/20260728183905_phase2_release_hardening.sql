-- Audit Phase 2 release hardening.
--
-- The first application migration pre-dated the project's explicit Data API
-- grant model, so these three public tables retained Supabase's legacy broad
-- grants. RLS protected row access, but table-level operations such as
-- TRUNCATE are not governed by RLS. Make every grant explicit before release.

revoke all on table public.tenant_demo_configs
  from anon, authenticated;
revoke all on table public.tenant_assignments
  from anon, authenticated;
revoke all on table public.user_profiles
  from anon, authenticated;

grant select on table public.tenant_demo_configs
  to authenticated;
grant select on table public.tenant_assignments
  to authenticated;
grant select, update on table public.user_profiles
  to authenticated;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- Keep the identity predicates stable and avoid re-evaluating auth functions
-- once per row.
drop policy if exists tenant_assignments_own_read
  on public.tenant_assignments;
create policy tenant_assignments_own_read
on public.tenant_assignments
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_profiles_own_read
  on public.user_profiles;
create policy user_profiles_own_read
on public.user_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_profiles_own_update
  on public.user_profiles;
create policy user_profiles_own_update
on public.user_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Foreign-key indexes keep authorization, evidence, audit, and cleanup paths
-- predictable inside the Phase 2 validation envelope.
do $$
declare
  target record;
  index_name text;
begin
  for target in
    select *
    from (
      values
        ('private', 'action_confirmations', 'user_id'),
        ('private', 'ai_usage_ledger', 'user_id'),
        ('private', 'invited_users', 'invited_by'),
        ('private', 'security_audit_events', 'user_id'),
        ('public', 'audit_packages', 'parent_package_id'),
        ('public', 'audit_packages', 'requested_by'),
        ('public', 'cate_evaluations', 'created_by'),
        ('public', 'cate_feedback', 'created_by'),
        ('public', 'cate_feedback', 'evaluation_id'),
        ('public', 'cate_feedback', 'tenant_id'),
        ('public', 'configuration_versions', 'approved_by'),
        ('public', 'configuration_versions', 'backup_owner_id'),
        ('public', 'configuration_versions', 'created_by'),
        ('public', 'configuration_versions', 'owner_id'),
        ('public', 'configuration_versions', 'supersedes_id'),
        ('public', 'document_access_events', 'actor_id'),
        ('public', 'document_access_events', 'document_version_id'),
        ('public', 'document_access_events', 'tenant_id'),
        ('public', 'document_records', 'created_by'),
        ('public', 'document_records', 'tenant_id'),
        ('public', 'document_versions', 'supersedes_version_id'),
        ('public', 'document_versions', 'uploaded_by'),
        ('public', 'evidence_links', 'created_by'),
        ('public', 'evidence_links', 'document_version_id'),
        ('public', 'evidence_links', 'tenant_id'),
        ('public', 'import_batches', 'approved_by'),
        ('public', 'import_batches', 'imported_by'),
        ('public', 'import_batches', 'posted_by'),
        ('public', 'import_batches', 'reversed_by'),
        ('public', 'import_batches', 'validated_by'),
        ('public', 'import_rows', 'tenant_id'),
        ('public', 'notification_outbox', 'recipient_id'),
        ('public', 'procurement_demo_snapshots', 'updated_by'),
        ('public', 'procurement_workflow_events', 'actor_id'),
        ('public', 'saved_metric_views', 'owner_id'),
        ('public', 'saved_metric_views', 'tenant_id'),
        ('public', 'security_exception_register', 'tenant_id'),
        ('public', 'tenant_assignments', 'tenant_id'),
        ('public', 'tenant_role_assignments', 'delegated_by'),
        ('public', 'work_queue_items', 'assignee_id')
    ) as indexes(schema_name, table_name, column_name)
  loop
    index_name := format(
      'idx_%s_%s',
      target.table_name,
      target.column_name
    );
    execute format(
      'create index if not exists %I on %I.%I (%I)',
      index_name,
      target.schema_name,
      target.table_name,
      target.column_name
    );
  end loop;
end
$$;

