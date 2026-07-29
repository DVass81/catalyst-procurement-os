-- The command-ledger RFQ projection trigger executes in the service-role
-- command transaction. Keep the helper private while allowing that trusted
-- transaction to maintain the normalized sourcing projection.

revoke all on function private.sync_procurement_rfq_kernel(
  text, jsonb, bigint, uuid
) from public, anon, authenticated;
grant execute on function private.sync_procurement_rfq_kernel(
  text, jsonb, bigint, uuid
) to service_role;
