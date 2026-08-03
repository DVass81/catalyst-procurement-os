begin;

create index if not exists phase3_contract_intelligence_validated_by_idx
  on public.phase3_contract_intelligence (validated_by)
  where validated_by is not null;

create index if not exists phase3_rehearsal_records_tenant_id_idx
  on public.phase3_rehearsal_records (tenant_id);

create index if not exists phase3_supplier_applications_supplier_user_id_idx
  on public.phase3_supplier_applications (supplier_user_id)
  where supplier_user_id is not null;

commit;
