begin;

alter table public.import_batches
  add column if not exists data_classification text
    not null default 'synthetic_demo',
  add column if not exists data_approval_reference text,
  add column if not exists data_attestation_type text
    not null default 'synthetic_demonstration_data',
  add column if not exists data_attested_at timestamptz
    not null default now(),
  add column if not exists data_attested_by uuid references auth.users(id);

alter table public.import_batches
  drop constraint if exists import_batches_data_intake_check;
alter table public.import_batches
  add constraint import_batches_data_intake_check
  check (
    (
      data_classification = 'synthetic_demo'
      and data_attestation_type = 'synthetic_demonstration_data'
      and data_approval_reference is null
    )
    or (
      data_classification = 'approved_pilot_procurement'
      and data_attestation_type =
        'approved_pilot_procurement_without_prohibited_data'
      and data_approval_reference is not null
      and length(trim(data_approval_reference)) between 8 and 160
      and data_attested_by is not null
    )
  );

alter table public.document_records
  add column if not exists data_classification text
    not null default 'synthetic_demo',
  add column if not exists data_approval_reference text,
  add column if not exists data_attestation_type text
    not null default 'synthetic_demonstration_data',
  add column if not exists data_attested_at timestamptz
    not null default now(),
  add column if not exists data_attested_by uuid references auth.users(id);

alter table public.document_records
  drop constraint if exists document_records_data_intake_check;
alter table public.document_records
  add constraint document_records_data_intake_check
  check (
    (
      data_classification = 'synthetic_demo'
      and data_attestation_type = 'synthetic_demonstration_data'
      and data_approval_reference is null
    )
    or (
      data_classification = 'approved_pilot_procurement'
      and data_attestation_type =
        'approved_pilot_procurement_without_prohibited_data'
      and data_approval_reference is not null
      and length(trim(data_approval_reference)) between 8 and 160
      and data_attested_by is not null
    )
  );

alter table public.document_versions
  add column if not exists scanner_metadata jsonb
    not null default '{}'::jsonb;

drop policy if exists tenant_member_read on public.import_batches;
drop policy if exists tenant_member_read on public.import_rows;
drop policy if exists tenant_member_read on public.document_records;
drop policy if exists tenant_member_read on public.document_versions;
drop policy if exists tenant_member_read on public.evidence_links;
drop policy if exists tenant_member_read on public.document_access_events;

revoke all on table public.import_batches from anon, authenticated;
revoke all on table public.import_rows from anon, authenticated;
revoke all on table public.document_records from anon, authenticated;
revoke all on table public.document_versions from anon, authenticated;
revoke all on table public.evidence_links from anon, authenticated;
revoke all on table public.document_access_events from anon, authenticated;

grant all on table public.import_batches to service_role;
grant all on table public.import_rows to service_role;
grant all on table public.document_records to service_role;
grant all on table public.document_versions to service_role;
grant all on table public.evidence_links to service_role;
grant all on table public.document_access_events to service_role;

comment on table public.import_rows is
  'Server-only quarantined import rows. Direct Data API access is revoked.';
comment on table public.document_versions is
  'Server-authorized evidence metadata. Direct Data API access is revoked.';

commit;
