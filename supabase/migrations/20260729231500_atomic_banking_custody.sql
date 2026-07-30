begin;

alter table public.supplier_identity_assignments
  alter column scopes set default array[
    'supplier_profile:read',
    'supplier_profile:update',
    'supplier_evidence:submit',
    'supplier_response:submit',
    'supplier_banking:submit'
  ]::text[];

update public.supplier_identity_assignments
set scopes = array_append(scopes, 'supplier_banking:submit')
where not ('supplier_banking:submit' = any(scopes));

create or replace function public.commit_supplier_banking_command(
  p_tenant_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_revision bigint,
  p_command_id uuid,
  p_command_type text,
  p_command jsonb,
  p_next_state jsonb,
  p_state_checksum text,
  p_supplier_organization_id text,
  p_algorithm text,
  p_ciphertext text,
  p_encrypted_data_key text,
  p_initialization_vector text,
  p_authentication_tag text,
  p_kms_key_id text,
  p_encryption_context jsonb,
  p_account_last_four text,
  p_routing_last_four text,
  p_evidence_reference text
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
  v_result record;
  v_envelope_id uuid;
  v_previous_envelope_id uuid;
  v_version integer;
  v_correlation_id uuid;
begin
  if p_command_type <> 'phase3_bank_propose' then
    raise exception 'BANKING_COMMAND_TYPE_INVALID';
  end if;
  if p_actor_role <> 'supplier_user' then
    raise exception 'BANKING_SUPPLIER_ACTOR_REQUIRED';
  end if;
  if p_algorithm <> 'AES-256-GCM' then
    raise exception 'BANKING_ALGORITHM_INVALID';
  end if;
  if p_account_last_four !~ '^[0-9]{4}$'
    or p_routing_last_four !~ '^[0-9]{4}$'
  then
    raise exception 'BANKING_MASKED_METADATA_INVALID';
  end if;
  if p_encryption_context ->> 'catalystTenant' <> p_tenant_id
    or p_encryption_context ->> 'catalystPurpose' <> 'supplier-banking'
  then
    raise exception 'BANKING_ENVELOPE_CONTEXT_MISMATCH';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(p_next_state #> '{phaseThree,supplierApplications}', '[]'::jsonb)
    ) as application
    where application ->> 'id' = p_command ->> 'applicationId'
      and application ->> 'supplierOrganizationId' =
        p_supplier_organization_id
      and application #>> '{bankingChange,proposedLastFour}' =
        p_account_last_four
      and application #>> '{bankingChange,status}' =
        'verification_pending'
  ) then
    raise exception 'BANKING_STATE_PROJECTION_MISMATCH';
  end if;

  select *
  into v_result
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

  if v_result.replayed then
    if not exists (
      select 1
      from private.supplier_banking_envelopes as envelope
      where envelope.tenant_id = p_tenant_id
        and envelope.source_command_id = p_command_id
    ) then
      raise exception 'BANKING_REPLAY_EVIDENCE_MISSING';
    end if;
    return query
    select
      v_result.state,
      v_result.revision,
      v_result.last_command_id,
      true;
    return;
  end if;

  select envelope.id
  into v_previous_envelope_id
  from private.supplier_banking_envelopes as envelope
  where envelope.tenant_id = p_tenant_id
    and envelope.supplier_organization_id = p_supplier_organization_id
  order by envelope.version desc
  limit 1
  for update;

  select coalesce(max(envelope.version), 0) + 1
  into v_version
  from private.supplier_banking_envelopes as envelope
  where envelope.tenant_id = p_tenant_id
    and envelope.supplier_organization_id = p_supplier_organization_id;

  insert into private.supplier_banking_envelopes (
    tenant_id, supplier_organization_id, version, algorithm, ciphertext,
    encrypted_data_key, initialization_vector, authentication_tag,
    kms_key_id, encryption_context, account_last_four, routing_last_four,
    submitted_by, source_command_id
  )
  values (
    p_tenant_id, p_supplier_organization_id, v_version, p_algorithm,
    p_ciphertext, p_encrypted_data_key, p_initialization_vector,
    p_authentication_tag, p_kms_key_id, p_encryption_context,
    p_account_last_four, p_routing_last_four, p_actor_id, p_command_id
  )
  returning id into v_envelope_id;

  v_correlation_id := (p_command ->> 'correlationId')::uuid;

  if v_previous_envelope_id is not null then
    insert into private.supplier_banking_control_events (
      tenant_id, banking_envelope_id, action, actor_id, actor_role,
      rationale, correlation_id, evidence_reference, source_command_id
    )
    values (
      p_tenant_id,
      v_previous_envelope_id,
      'superseded',
      p_actor_id,
      p_actor_role,
      'Superseded by a newly encrypted supplier banking instruction.',
      v_correlation_id,
      p_evidence_reference,
      p_command_id
    );
  end if;

  insert into private.supplier_banking_control_events (
    tenant_id, banking_envelope_id, action, actor_id, actor_role,
    rationale, correlation_id, evidence_reference, source_command_id
  )
  values (
    p_tenant_id,
    v_envelope_id,
    'submitted',
    p_actor_id,
    p_actor_role,
    p_command ->> 'reason',
    v_correlation_id,
    p_evidence_reference,
    p_command_id
  );

  return query
  select
    v_result.state,
    v_result.revision,
    v_result.last_command_id,
    false;
end;
$$;

revoke all on function public.commit_supplier_banking_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text, text, text,
  text, text, text, text, text, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.commit_supplier_banking_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text, text, text,
  text, text, text, text, text, jsonb, text, text, text
) to service_role;

create or replace function public.commit_supplier_banking_control_command(
  p_tenant_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_revision bigint,
  p_command_id uuid,
  p_command_type text,
  p_command jsonb,
  p_next_state jsonb,
  p_state_checksum text,
  p_supplier_organization_id text,
  p_control_action text,
  p_evidence_reference text
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
  v_result record;
  v_envelope_id uuid;
  v_expected_state text;
  v_correlation_id uuid;
begin
  if p_control_action not in (
    'out_of_band_verified',
    'approved',
    'rejected'
  ) then
    raise exception 'BANKING_CONTROL_ACTION_INVALID';
  end if;
  if (
    p_command_type = 'phase3_bank_verify'
    and (
      p_control_action <> 'out_of_band_verified'
      or p_actor_role <> 'compliance_reviewer'
    )
  ) or (
    p_command_type = 'phase3_bank_decide'
    and (
      p_control_action not in ('approved', 'rejected')
      or p_actor_role <> 'finance_reviewer'
    )
  ) or p_command_type not in ('phase3_bank_verify', 'phase3_bank_decide')
  then
    raise exception 'BANKING_CONTROL_ROLE_OR_COMMAND_INVALID';
  end if;

  v_expected_state := case
    when p_control_action = 'out_of_band_verified' then 'approval_pending'
    when p_control_action = 'approved' then 'approved'
    else 'rejected'
  end;
  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(p_next_state #> '{phaseThree,supplierApplications}', '[]'::jsonb)
    ) as application
    where application ->> 'id' = p_command ->> 'applicationId'
      and application ->> 'supplierOrganizationId' =
        p_supplier_organization_id
      and application #>> '{bankingChange,status}' = v_expected_state
      and application #>> '{bankingChange,paymentInitiated}' = 'false'
  ) then
    raise exception 'BANKING_CONTROL_STATE_MISMATCH';
  end if;

  select *
  into v_result
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

  if v_result.replayed then
    if not exists (
      select 1
      from private.supplier_banking_control_events as event
      where event.tenant_id = p_tenant_id
        and event.source_command_id = p_command_id
        and event.action = p_control_action
    ) then
      raise exception 'BANKING_CONTROL_REPLAY_EVIDENCE_MISSING';
    end if;
    return query
    select
      v_result.state,
      v_result.revision,
      v_result.last_command_id,
      true;
    return;
  end if;

  select envelope.id
  into v_envelope_id
  from private.supplier_banking_envelopes as envelope
  where envelope.tenant_id = p_tenant_id
    and envelope.supplier_organization_id = p_supplier_organization_id
  order by envelope.version desc
  limit 1
  for update;
  if v_envelope_id is null then
    raise exception 'BANKING_ENVELOPE_NOT_FOUND';
  end if;

  v_correlation_id := (p_command ->> 'correlationId')::uuid;
  insert into private.supplier_banking_control_events (
    tenant_id, banking_envelope_id, action, actor_id, actor_role,
    rationale, correlation_id, evidence_reference, source_command_id
  )
  values (
    p_tenant_id,
    v_envelope_id,
    p_control_action,
    p_actor_id,
    p_actor_role,
    p_command ->> 'reason',
    v_correlation_id,
    p_evidence_reference,
    p_command_id
  );

  return query
  select
    v_result.state,
    v_result.revision,
    v_result.last_command_id,
    false;
end;
$$;

revoke all on function public.commit_supplier_banking_control_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.commit_supplier_banking_control_command(
  text, uuid, text, bigint, uuid, text, jsonb, jsonb, text, text, text, text
) to service_role;

commit;
