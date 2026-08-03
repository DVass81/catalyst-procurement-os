begin;

alter table public.procurement_purchase_orders
  add column if not exists vendor_acknowledgment text,
  add column if not exists change_order_history text[] not null default '{}';

alter table public.procurement_receipts
  add column if not exists packing_slip text,
  add column if not exists photo_references text[] not null default '{}';

alter table public.procurement_receipt_lines
  add column if not exists serial_numbers text[] not null default '{}',
  add column if not exists lot_numbers text[] not null default '{}',
  add column if not exists service_accepted boolean,
  add column if not exists service_acceptance_evidence text;

alter table public.procurement_receipt_lines
  drop constraint if exists procurement_receipt_lines_service_evidence_check;
alter table public.procurement_receipt_lines
  add constraint procurement_receipt_lines_service_evidence_check
  check (
    service_accepted is distinct from true
    or (
      service_acceptance_evidence is not null
      and length(trim(service_acceptance_evidence)) >= 3
    )
  );

alter table public.procurement_invoices
  add column if not exists uploaded_document text,
  add column if not exists match_mode text,
  add column if not exists match_evidence text[] not null default '{}',
  add column if not exists invoice_type text not null default 'standard',
  add column if not exists original_invoice_id text;

alter table public.procurement_invoices
  drop constraint if exists procurement_invoices_match_mode_check;
alter table public.procurement_invoices
  add constraint procurement_invoices_match_mode_check
  check (
    match_mode is null
    or match_mode in ('two_way', 'three_way')
  );

alter table public.procurement_invoices
  drop constraint if exists procurement_invoices_invoice_type_check;
alter table public.procurement_invoices
  add constraint procurement_invoices_invoice_type_check
  check (invoice_type in ('standard', 'credit'));

alter table public.procurement_invoices
  drop constraint if exists procurement_invoices_original_invoice_fk;
alter table public.procurement_invoices
  add constraint procurement_invoices_original_invoice_fk
  foreign key (tenant_id, original_invoice_id)
  references public.procurement_invoices(tenant_id, id);

alter table public.procurement_invoices
  drop constraint if exists procurement_invoices_tenant_id_supplier_id_invoice_number_key;
create index if not exists procurement_invoices_duplicate_detection_idx
  on public.procurement_invoices (
    tenant_id,
    supplier_id,
    lower(invoice_number)
  );

create or replace function private.populate_operational_po_extensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purchase_order_record jsonb;
begin
  select purchase_order_item.value
    into purchase_order_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'purchaseOrders', '[]'::jsonb)
  ) as purchase_order_item(value)
  where snapshot.tenant_id = new.tenant_id
    and purchase_order_item.value ->> 'id' = new.id
  limit 1;

  if purchase_order_record is not null then
    new.vendor_acknowledgment :=
      nullif(purchase_order_record ->> 'vendorAcknowledgment', '');
    new.change_order_history := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(
            purchase_order_record -> 'changeOrderHistory',
            '[]'::jsonb
          )
        )
      ),
      '{}'::text[]
    );
  end if;
  return new;
end;
$$;

create or replace function private.populate_operational_receipt_extensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_record jsonb;
begin
  select receipt_item.value
    into receipt_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'receipts', '[]'::jsonb)
  ) as receipt_item(value)
  where snapshot.tenant_id = new.tenant_id
    and receipt_item.value ->> 'id' = new.id
  limit 1;

  if receipt_record is not null then
    new.packing_slip := nullif(receipt_record ->> 'packingSlip', '');
    new.photo_references := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(receipt_record -> 'photos', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    );
  end if;
  return new;
end;
$$;

create or replace function private.populate_operational_receipt_line_extensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_line_record jsonb;
begin
  select line_item.value
    into receipt_line_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'receipts', '[]'::jsonb)
  ) as receipt_item(value)
  cross join lateral jsonb_array_elements(
    coalesce(receipt_item.value -> 'lines', '[]'::jsonb)
  ) as line_item(value)
  where snapshot.tenant_id = new.tenant_id
    and receipt_item.value ->> 'id' = new.receipt_id
    and line_item.value ->> 'lineId' = new.line_id
  limit 1;

  if receipt_line_record is not null then
    new.serial_numbers := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(
            receipt_line_record -> 'serialNumbers',
            '[]'::jsonb
          )
        )
      ),
      '{}'::text[]
    );
    new.lot_numbers := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(
            receipt_line_record -> 'lotNumbers',
            '[]'::jsonb
          )
        )
      ),
      '{}'::text[]
    );
    new.service_accepted :=
      nullif(receipt_line_record ->> 'serviceAccepted', '')::boolean;
    new.service_acceptance_evidence :=
      nullif(
        receipt_line_record ->> 'serviceAcceptanceEvidence',
        ''
      );
  end if;
  return new;
end;
$$;

create or replace function private.populate_operational_invoice_extensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_record jsonb;
begin
  select invoice_item.value
    into invoice_record
  from public.procurement_demo_snapshots as snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'invoices', '[]'::jsonb)
  ) as invoice_item(value)
  where snapshot.tenant_id = new.tenant_id
    and invoice_item.value ->> 'id' = new.id
  limit 1;

  if invoice_record is not null then
    new.uploaded_document :=
      nullif(invoice_record ->> 'uploadedDocument', '');
    new.match_mode := nullif(invoice_record ->> 'matchMode', '');
    new.match_evidence := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(invoice_record -> 'matchEvidence', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    );
    new.invoice_type := coalesce(
      nullif(invoice_record ->> 'invoiceType', ''),
      'standard'
    );
    new.original_invoice_id :=
      nullif(invoice_record ->> 'originalInvoiceId', '');
  end if;
  return new;
end;
$$;

drop trigger if exists populate_operational_po_extensions
  on public.procurement_purchase_orders;
create trigger populate_operational_po_extensions
before insert or update on public.procurement_purchase_orders
for each row
execute function private.populate_operational_po_extensions();

drop trigger if exists populate_operational_receipt_extensions
  on public.procurement_receipts;
create trigger populate_operational_receipt_extensions
before insert or update on public.procurement_receipts
for each row
execute function private.populate_operational_receipt_extensions();

drop trigger if exists populate_operational_receipt_line_extensions
  on public.procurement_receipt_lines;
create trigger populate_operational_receipt_line_extensions
before insert or update on public.procurement_receipt_lines
for each row
execute function private.populate_operational_receipt_line_extensions();

drop trigger if exists populate_operational_invoice_extensions
  on public.procurement_invoices;
create trigger populate_operational_invoice_extensions
before insert or update on public.procurement_invoices
for each row
execute function private.populate_operational_invoice_extensions();

update public.procurement_purchase_orders as target
set vendor_acknowledgment =
      nullif(purchase_order_record ->> 'vendorAcknowledgment', ''),
    change_order_history = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(
            purchase_order_record -> 'changeOrderHistory',
            '[]'::jsonb
          )
        )
      ),
      '{}'::text[]
    )
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'purchaseOrders', '[]'::jsonb)
) as purchase_order_record
where target.tenant_id = snapshot.tenant_id
  and target.id = purchase_order_record ->> 'id';

update public.procurement_receipts as target
set packing_slip = nullif(receipt_record ->> 'packingSlip', ''),
    photo_references = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(receipt_record -> 'photos', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    )
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'receipts', '[]'::jsonb)
) as receipt_record
where target.tenant_id = snapshot.tenant_id
  and target.id = receipt_record ->> 'id';

update public.procurement_receipt_lines as target
set serial_numbers = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(line_record -> 'serialNumbers', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    ),
    lot_numbers = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(line_record -> 'lotNumbers', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    ),
    service_accepted =
      nullif(line_record ->> 'serviceAccepted', '')::boolean,
    service_acceptance_evidence =
      nullif(line_record ->> 'serviceAcceptanceEvidence', '')
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'receipts', '[]'::jsonb)
) as receipt_record
cross join lateral jsonb_array_elements(
  coalesce(receipt_record -> 'lines', '[]'::jsonb)
) as line_record
where target.tenant_id = snapshot.tenant_id
  and target.receipt_id = receipt_record ->> 'id'
  and target.line_id = line_record ->> 'lineId';

update public.procurement_invoices as target
set uploaded_document =
      nullif(invoice_record ->> 'uploadedDocument', ''),
    match_mode = nullif(invoice_record ->> 'matchMode', ''),
    match_evidence = coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(invoice_record -> 'matchEvidence', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    ),
    invoice_type = coalesce(
      nullif(invoice_record ->> 'invoiceType', ''),
      'standard'
    ),
    original_invoice_id =
      nullif(invoice_record ->> 'originalInvoiceId', '')
from public.procurement_demo_snapshots as snapshot
cross join lateral jsonb_array_elements(
  coalesce(snapshot.state -> 'invoices', '[]'::jsonb)
) as invoice_record
where target.tenant_id = snapshot.tenant_id
  and target.id = invoice_record ->> 'id';

revoke all on function private.populate_operational_po_extensions()
  from public, anon, authenticated;
grant execute on function private.populate_operational_po_extensions()
  to service_role;
revoke all on function private.populate_operational_receipt_extensions()
  from public, anon, authenticated;
grant execute on function private.populate_operational_receipt_extensions()
  to service_role;
revoke all on function private.populate_operational_receipt_line_extensions()
  from public, anon, authenticated;
grant execute on function private.populate_operational_receipt_line_extensions()
  to service_role;
revoke all on function private.populate_operational_invoice_extensions()
  from public, anon, authenticated;
grant execute on function private.populate_operational_invoice_extensions()
  to service_role;

commit;
