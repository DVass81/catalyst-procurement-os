-- A second synthetic tenant is initialized lazily by the authoritative
-- repository. Permit only the trusted service-role transaction to invoke the
-- snapshot trigger that bootstraps its normalized procurement kernel.

revoke all on function private.initialize_procurement_kernel()
  from public, anon, authenticated;
grant execute on function private.initialize_procurement_kernel()
  to service_role;

