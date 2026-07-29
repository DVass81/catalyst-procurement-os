-- A kernel bootstrap command is written before the normalized request rows
-- exist. Defer the RFQ projection for that one command, then project sourcing
-- after the base transaction kernel has been initialized.

create or replace function private.sync_rfq_from_command()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  if new.command_type = 'kernel_bootstrap' then
    return new;
  end if;

  select state
  into v_state
  from public.procurement_demo_snapshots
  where tenant_id = new.tenant_id;

  perform private.sync_procurement_rfq_kernel(
    new.tenant_id,
    v_state,
    new.result_revision,
    new.command_id
  );
  return new;
end;
$$;

revoke all on function private.sync_rfq_from_command()
  from public, anon, authenticated;
grant execute on function private.sync_rfq_from_command()
  to service_role;

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

  perform private.sync_procurement_rfq_kernel(
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
grant execute on function private.initialize_procurement_kernel()
  to service_role;
