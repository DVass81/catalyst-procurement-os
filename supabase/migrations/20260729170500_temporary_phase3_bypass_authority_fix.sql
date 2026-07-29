-- Keep the temporary bypass authorization inside tables available to the
-- service-role RPC. Protected Auth metadata is independently validated by the
-- application session before this label can be submitted.

create or replace function private.commit_demo_command(
  p_tenant_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_revision bigint,
  p_command_id uuid,
  p_command_type text,
  p_command jsonb,
  p_next_state jsonb,
  p_state_checksum text
)
returns table (
  state jsonb,
  revision bigint,
  last_command_id uuid,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.procurement_demo_snapshots%rowtype;
  v_existing public.procurement_command_ledger%rowtype;
  v_previous_hash text;
  v_next_revision bigint;
  v_event_hash text;
  v_request_hash text;
  v_correlation_id uuid;
  v_requested_correlation text;
begin
  if p_state_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_STATE_CHECKSUM';
  end if;

  select *
    into v_current
    from public.procurement_demo_snapshots
    where tenant_id = p_tenant_id
    for update;

  if not found then
    raise exception 'STATE_NOT_INITIALIZED';
  end if;

  v_request_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_command_type,
        p_command::text,
        p_expected_revision::text
      ),
      'sha256'
    ),
    'hex'
  );

  select *
    into v_existing
    from public.procurement_command_ledger
    where tenant_id = p_tenant_id
      and command_id = p_command_id;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
      select v_current.state, v_current.revision, p_command_id, true;
    return;
  end if;

  if p_actor_role = 'staging_bypass_presenter' then
    if not exists (
      select 1
      from public.tenant_assignments as assignment
      where assignment.user_id = p_actor_id
        and assignment.tenant_id = p_tenant_id
        and assignment.role = 'presenter'
        and now() < '2026-08-13T03:59:59Z'::timestamptz
        and (
          select count(*)
          from public.tenant_role_assignments as role_assignment
          where role_assignment.user_id = p_actor_id
            and role_assignment.tenant_id = p_tenant_id
            and role_assignment.assignment_type = 'presenter_simulation'
            and role_assignment.suspended_at is null
            and role_assignment.starts_at <= now()
            and role_assignment.expires_at =
              '2026-08-13T03:59:59Z'::timestamptz
        ) = 16
    ) then
      raise exception 'COMMAND_AUTHORITY_DENIED';
    end if;
  elsif not exists (
    select 1
    from public.tenant_assignments as assignment
    where assignment.user_id = p_actor_id
      and assignment.tenant_id = p_tenant_id
      and assignment.role = p_actor_role
  ) then
    raise exception 'COMMAND_AUTHORITY_DENIED';
  end if;

  if v_current.revision <> p_expected_revision then
    raise exception 'REVISION_CONFLICT';
  end if;

  v_next_revision := v_current.revision + 1;
  select event_hash
    into v_previous_hash
    from public.procurement_workflow_events
    where tenant_id = p_tenant_id
    order by state_revision desc
    limit 1;

  v_event_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_tenant_id,
        p_command_id::text,
        p_command_type,
        p_command::text,
        p_actor_id::text,
        p_actor_role,
        v_next_revision::text,
        p_state_checksum,
        coalesce(v_previous_hash, '')
      ),
      'sha256'
    ),
    'hex'
  );

  v_requested_correlation := p_command ->> 'correlationId';
  v_correlation_id := case
    when v_requested_correlation
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then v_requested_correlation::uuid
    else p_command_id
  end;

  update public.procurement_demo_snapshots
    set state = p_next_state,
        revision = v_next_revision,
        state_checksum = p_state_checksum,
        last_command_id = p_command_id,
        updated_by = p_actor_id,
        updated_at = now()
    where tenant_id = p_tenant_id;

  insert into public.procurement_workflow_events (
    tenant_id, command_id, command_type, command_payload, actor_id,
    actor_role, state_revision, state_checksum, previous_event_hash,
    event_hash
  )
  values (
    p_tenant_id, p_command_id, p_command_type, p_command, p_actor_id,
    p_actor_role, v_next_revision, p_state_checksum, v_previous_hash,
    v_event_hash
  );

  insert into public.procurement_command_ledger (
    tenant_id, command_id, command_type, request_hash, command_payload,
    actor_id, actor_role, expected_revision, result_revision,
    result_checksum, correlation_id
  )
  values (
    p_tenant_id, p_command_id, p_command_type, v_request_hash, p_command,
    p_actor_id, p_actor_role, p_expected_revision, v_next_revision,
    p_state_checksum, v_correlation_id
  );

  perform private.sync_procurement_kernel(
    p_tenant_id,
    p_next_state,
    v_next_revision,
    p_command_id
  );

  if p_command_type like 'phase3_%' then
    insert into public.procurement_projection_outbox (
      tenant_id, command_id, projection_type, payload
    )
    values (
      p_tenant_id,
      p_command_id,
      'phase3_registry',
      p_next_state -> 'phaseThree'
    )
    on conflict (tenant_id, command_id, projection_type) do nothing;
  end if;

  return query
    select p_next_state, v_next_revision, p_command_id, false;
end;
$$;

revoke all on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function private.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) to service_role;

