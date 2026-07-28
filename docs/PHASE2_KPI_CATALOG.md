# Audit Phase 2 certified KPI catalog

The authoritative definitions are in `src/analytics/kpi-catalog.ts`. Each of
the 32 versioned definitions includes its business question, formula, grain,
numerator, denominator, inclusions, exclusions, owner, source lineage,
freshness cadence, target, target owner, target label/effective date, action
threshold, paired guardrail, and drilldown path.

All current targets are labeled synthetic demo targets. They are not customer
baselines or commitments.

## Outcome metrics

1. Addressable spend under management
2. Policy-compliant spend rate
3. Contract-covered spend rate
4. Accepted savings
5. Realized savings
6. Inventory-reuse cost avoidance
7. Requisition-to-order cycle time
8. On-time, in-full accepted delivery rate
9. First-pass invoice match rate
10. Exception value at risk
11. Supplier risk exposure
12. Contract-renewal exposure

## Driver metrics

1. Requisition completeness rate
2. Approval queue age
3. Competitive-sourcing coverage
4. Supplier-response coverage
5. Purchase-order acknowledgment time
6. Receipt posting and inspection latency
7. Invoice extraction-review age
8. Mismatch rate by root cause
9. Exception resolution time
10. Document and evidence completeness

## Guardrails

1. Emergency and maverick spend
2. Single-source award rate
3. Split-purchase risk
4. Post-approval change rate
5. Over-receipt exception rate
6. Tolerance-based auto-match rate
7. Savings reversal rate
8. High-risk supplier exposure
9. Data-quality and freshness failure rate
10. CATE recommendation override and correction rate

## Display and reconciliation contract

The role scorecard displays the metric value, target, variance, trend,
forecast where applicable, primary drivers, freshness, coverage, data-quality
warning, and action playbook. Primary cards drill into contributing records
without leaving the tenant or current synthetic state.

Dashboard calculations use the same authoritative `DemoState` as the workflow.
Before release, independently reconcile the connected dashboard, CSV extract,
and audit package against a frozen golden dataset and record reviewer signoff.
