-- Mission Back on Track M3: upgrade existing authoritative snapshots to the
-- versioned sourcing dataset through the same audited command ledger used by
-- the application. New tenants are initialized directly from the v2 seed.

do $$
declare
  snapshot record;
  v_actor_id uuid;
  v_actor_role text;
  v_state jsonb;
  v_session_date date;
  v_response_deadline date;
  v_required_by_date date;
  v_retention_until date;
  v_rfq jsonb;
  v_checksum text;
  v_days integer;
  v_cursor date;
begin
  for snapshot in
    select tenant_id, state, revision
    from public.procurement_demo_snapshots
    where coalesce(state #>> '{phaseThree,schemaVersion}', '0')::integer < 2
       or jsonb_array_length(
            coalesce(state #> '{phaseThree,rfqs}', '[]'::jsonb)
          ) = 0
  loop
    select assignment.user_id, assignment.role
      into v_actor_id, v_actor_role
      from public.tenant_assignments as assignment
      where assignment.tenant_id = snapshot.tenant_id
      order by
        case assignment.role
          when 'system_admin' then 0
          when 'presenter' then 1
          else 2
        end,
        assignment.created_at,
        assignment.user_id
      limit 1;

    if v_actor_id is null then
      raise exception 'RFQ_DATASET_UPGRADE_REQUIRES_TENANT_ACTOR:%',
        snapshot.tenant_id;
    end if;

    v_state := snapshot.state;
    v_session_date := (v_state ->> 'sessionDate')::date;

    v_cursor := v_session_date;
    v_days := 0;
    while v_days < 5 loop
      v_cursor := v_cursor + 1;
      if extract(isodow from v_cursor) between 1 and 5 then
        v_days := v_days + 1;
      end if;
    end loop;
    v_response_deadline := v_cursor;

    v_cursor := v_session_date;
    v_days := 0;
    while v_days < 12 loop
      v_cursor := v_cursor + 1;
      if extract(isodow from v_cursor) between 1 and 5 then
        v_days := v_days + 1;
      end if;
    end loop;
    v_required_by_date := v_cursor;
    v_retention_until := v_session_date + 2555;

    v_rfq := jsonb_build_object(
      'id', 'rfq-loan-officer-package',
      'rfqNumber',
        concat(
          case
            when snapshot.tenant_id = 'org-y12-demo' then 'Y12'
            else 'CCCU'
          end,
          '-RFQ-2026-00031'
        ),
      'requestId', 'req-loan-officer-package',
      'title', 'Loan officer technology and workspace package',
      'description',
        'Competitive request for the approved equipment and furniture package supporting three fictional loan-officer hires.',
      'sourcingMethod', 'rfq',
      'lifecycleState', 'draft',
      'currency', 'USD',
      'responseDeadline', to_char(v_response_deadline, 'YYYY-MM-DD'),
      'sealedUntil',
        concat(to_char(v_response_deadline, 'YYYY-MM-DD'), 'T17:00:00.000Z'),
      'retentionUntil', to_char(v_retention_until, 'YYYY-MM-DD'),
      'termsVersion', 'synthetic-standard-terms-v1',
      'evaluationVersion', 'balanced-evaluation-v1',
      'lines', jsonb_build_array(
        jsonb_build_object(
          'id', 'rfq-line-laptop',
          'requestLineId', 'line-laptop',
          'description', 'Approved 14-inch business laptop',
          'quantity', 3,
          'unitOfMeasure', 'each',
          'requiredByDate', to_char(v_required_by_date, 'YYYY-MM-DD'),
          'specification',
            '14-inch business laptop, encrypted SSD, 3-year warranty'
        ),
        jsonb_build_object(
          'id', 'rfq-line-monitor',
          'requestLineId', 'line-monitor',
          'description', 'Approved 24-inch monitor',
          'quantity', 6,
          'unitOfMeasure', 'each',
          'requiredByDate', to_char(v_required_by_date, 'YYYY-MM-DD'),
          'specification', '24-inch IPS monitor with adjustable stand'
        ),
        jsonb_build_object(
          'id', 'rfq-line-dock',
          'requestLineId', 'line-dock',
          'description', 'Approved USB-C docking station',
          'quantity', 3,
          'unitOfMeasure', 'each',
          'requiredByDate', to_char(v_required_by_date, 'YYYY-MM-DD'),
          'specification', 'Dual display and 100W power delivery'
        ),
        jsonb_build_object(
          'id', 'rfq-line-headset',
          'requestLineId', 'line-headset',
          'description', 'Approved unified communications headset',
          'quantity', 3,
          'unitOfMeasure', 'each',
          'requiredByDate', to_char(v_required_by_date, 'YYYY-MM-DD'),
          'specification', 'Wired USB headset with noise cancellation'
        ),
        jsonb_build_object(
          'id', 'rfq-line-chair',
          'requestLineId', 'line-chair',
          'description', 'Approved ergonomic task chair',
          'quantity', 3,
          'unitOfMeasure', 'each',
          'requiredByDate', to_char(v_required_by_date, 'YYYY-MM-DD'),
          'specification',
            'Adjustable task chair meeting the approved ergonomic standard'
        )
      ),
      'suppliers', jsonb_build_array(
        jsonb_build_object(
          'supplierId', 'vendor-001',
          'supplierOrganizationId', 'supplier-org-volunteer',
          'supplierName', 'Volunteer Technology Partners',
          'status', 'selected'
        ),
        jsonb_build_object(
          'supplierId', 'vendor-002',
          'supplierOrganizationId', 'supplier-org-ridgeline',
          'supplierName', 'Ridgeline Office Systems',
          'status', 'selected'
        ),
        jsonb_build_object(
          'supplierId', 'vendor-003',
          'supplierOrganizationId', 'supplier-org-blue-ridge',
          'supplierName', 'Blue Ridge Network Solutions',
          'status', 'selected'
        )
      ),
      'responses', '[]'::jsonb,
      'evaluations', '[]'::jsonb,
      'bafoRound', 1,
      'version', 1,
      'correlationId', '31313131-3131-4131-8131-313131313131'
    );

    v_state := jsonb_set(
      v_state,
      '{phaseThree,schemaVersion}',
      to_jsonb(2),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,version}',
      to_jsonb('mission-back-on-track-demo-v2'::text),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,schemaVersion}',
      to_jsonb(2),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,contentHash}',
      to_jsonb(
        '41075b63fc919cac39658a40f1f3c18f2af1002a58e7fbc32f9164144913a654'
        ::text
      ),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,expectedRecordCounts,rfqs}',
      to_jsonb(1),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,rfqs}',
      jsonb_build_array(v_rfq),
      true
    );
    v_checksum := encode(
      extensions.digest(v_state::text, 'sha256'),
      'hex'
    );

    perform private.commit_demo_command(
      snapshot.tenant_id,
      v_actor_id,
      v_actor_role,
      snapshot.revision,
      '32323232-3232-4232-8232-323232323232'::uuid,
      'phase3_dataset_upgrade',
      jsonb_build_object(
        'type', 'phase3_dataset_upgrade',
        'correlationId', '32323232-3232-4232-8232-323232323232',
        'reason',
          'Upgrade the authoritative synthetic dataset to the governed RFQ schema.'
      ),
      v_state,
      v_checksum
    );
  end loop;
end
$$;
