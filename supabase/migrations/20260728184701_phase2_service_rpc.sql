create or replace function public.commit_demo_command(
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
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.commit_demo_command(
    p_tenant_id,
    p_actor_id,
    p_actor_role,
    p_expected_revision,
    p_command_id,
    p_command_type,
    p_command,
    p_next_state,
    p_state_checksum
  );
$$;

revoke all on function public.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.commit_demo_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text
) to service_role;

grant insert on table private.ai_usage_ledger to service_role;

create or replace function public.record_ai_usage(
  p_id uuid,
  p_tenant_id text,
  p_provider text,
  p_model text,
  p_capability text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_duration_seconds integer,
  p_estimated_cost_usd numeric,
  p_session_id text,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.ai_usage_ledger (
    id,
    tenant_id,
    provider,
    model,
    capability,
    input_tokens,
    output_tokens,
    duration_seconds,
    estimated_cost_usd,
    session_id,
    occurred_at
  )
  values (
    p_id,
    p_tenant_id,
    p_provider,
    p_model,
    p_capability,
    p_input_tokens,
    p_output_tokens,
    p_duration_seconds,
    p_estimated_cost_usd,
    p_session_id,
    p_occurred_at
  );

  return p_id;
end;
$$;

revoke all on function public.record_ai_usage(
  uuid, text, text, text, text, bigint, bigint, integer, numeric, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_ai_usage(
  uuid, text, text, text, text, bigint, bigint, integer, numeric, text, timestamptz
) to service_role;

