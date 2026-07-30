-- Mission Back on Track M3: align the authoritative RFQ with the optimized
-- external purchase quantities used by the connected request-to-PO workflow.

do $$
declare
  snapshot record;
  v_actor_id uuid;
  v_actor_role text;
  v_state jsonb;
  v_rfqs jsonb;
  v_checksum text;
begin
  for snapshot in
    select tenant_id, state, revision
    from public.procurement_demo_snapshots
    where state #>> '{phaseThree,dataset,version}'
      = 'mission-back-on-track-demo-v2'
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
      raise exception 'CONNECTED_SOURCING_UPGRADE_REQUIRES_TENANT_ACTOR:%',
        snapshot.tenant_id;
    end if;

    select jsonb_agg(
      case
        when rfq ->> 'id' = 'rfq-loan-officer-package'
          then jsonb_set(
            rfq,
            '{lines}',
            (
              select jsonb_agg(
                case
                  when line ->> 'id' = 'rfq-line-monitor'
                    then jsonb_set(line, '{quantity}', to_jsonb(3), true)
                  else line
                end
                order by line_ordinal
              )
              from jsonb_array_elements(
                coalesce(rfq -> 'lines', '[]'::jsonb)
              ) with ordinality as rfq_lines(line, line_ordinal)
            ),
            true
          )
        else rfq
      end
      order by rfq_ordinal
    )
    into v_rfqs
    from jsonb_array_elements(
      coalesce(snapshot.state #> '{phaseThree,rfqs}', '[]'::jsonb)
    ) with ordinality as source_rfqs(rfq, rfq_ordinal);

    v_state := jsonb_set(
      snapshot.state,
      '{phaseThree,rfqs}',
      coalesce(v_rfqs, '[]'::jsonb),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,version}',
      to_jsonb('mission-back-on-track-demo-v3'::text),
      true
    );
    v_state := jsonb_set(
      v_state,
      '{phaseThree,dataset,contentHash}',
      to_jsonb(
        '44f05b06ee913c193f73d125887c6cf068e618fcc0fe84e8b061fe9bc0f6d47a'
        ::text
      ),
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
      '33333333-3333-4333-8333-333333333333'::uuid,
      'phase3_connected_sourcing_upgrade',
      jsonb_build_object(
        'type', 'phase3_connected_sourcing_upgrade',
        'correlationId', '33333333-3333-4333-8333-333333333333',
        'reason',
          'Align authoritative RFQ quantities to the optimized external purchase requirement.'
      ),
      v_state,
      v_checksum
    );
  end loop;
end
$$;
