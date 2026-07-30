-- Mission Back on Track M3: supplier metadata must remain hidden until the
-- sourcing event is explicitly released to that supplier organization.

drop policy if exists own_rfq_invitation_read
  on public.procurement_rfq_suppliers;
create policy own_rfq_invitation_read
on public.procurement_rfq_suppliers
for select to authenticated
using (
  private.can_supplier_read_rfq(tenant_id, rfq_id)
  and private.is_supplier_organization_member(
    tenant_id,
    supplier_organization_id
  )
);

drop policy if exists own_rfq_response_read
  on public.procurement_rfq_responses;
create policy own_rfq_response_read
on public.procurement_rfq_responses
for select to authenticated
using (
  private.can_supplier_read_rfq(tenant_id, rfq_id)
  and private.is_supplier_organization_member(
    tenant_id,
    supplier_organization_id
  )
);

drop policy if exists awarded_supplier_read
  on public.procurement_rfq_awards;
create policy awarded_supplier_read
on public.procurement_rfq_awards
for select to authenticated
using (
  private.can_supplier_read_rfq(tenant_id, rfq_id)
  and exists (
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
