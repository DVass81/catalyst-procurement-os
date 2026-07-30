export const productionReadinessCategories = [
  { id: "resilience", label: "Production resilience", weight: 15 },
  { id: "security_privacy", label: "Security and privacy", weight: 20 },
  { id: "identity_access", label: "Identity and access", weight: 10 },
  { id: "data_recovery", label: "Data protection and recovery", weight: 15 },
  { id: "operations_support", label: "Operations and support", weight: 10 },
  { id: "governance_compliance", label: "Governance and compliance evidence", weight: 10 },
  { id: "scale_performance", label: "Scale and performance", weight: 10 },
  { id: "customer_integrations", label: "Customer integrations", weight: 10 },
] as const;

export type ProductionReadinessCategoryId =
  (typeof productionReadinessCategories)[number]["id"];

export interface ProductionReadinessCategoryResult {
  categoryId: ProductionReadinessCategoryId;
  score: number;
  artifactId?: string;
  independentlyReviewed: boolean;
}

export function evaluateProductionReadiness(input: {
  results: readonly ProductionReadinessCategoryResult[];
  openCritical: number;
  openHigh: number;
  openMedium: number;
}) {
  const blockers: string[] = [];
  const byCategory = new Map(
    input.results.map((result) => [result.categoryId, result]),
  );
  let weightedScore = 0;
  for (const category of productionReadinessCategories) {
    const result = byCategory.get(category.id);
    if (!result) {
      blockers.push(`Missing production-readiness result: ${category.label}.`);
      continue;
    }
    if (
      !Number.isFinite(result.score) ||
      result.score < 0 ||
      result.score > 100
    ) {
      blockers.push(`Invalid production-readiness score: ${category.label}.`);
      continue;
    }
    weightedScore += (result.score * category.weight) / 100;
    if (result.score < 90) {
      blockers.push(`${category.label} must score at least 90.`);
    }
    if (!result.artifactId?.trim() || !result.independentlyReviewed) {
      blockers.push(
        `${category.label} requires retained independent evidence.`,
      );
    }
  }
  if (input.openCritical || input.openHigh || input.openMedium) {
    blockers.push(
      "Production readiness permits no unresolved Critical, High, or Medium findings.",
    );
  }
  const score = Number(weightedScore.toFixed(2));
  if (score < 95) {
    blockers.push("Production readiness must score at least 95.");
  }
  return {
    score,
    ready: blockers.length === 0,
    claim:
      blockers.length === 0
        ? ("production-readiness-evidence-complete" as const)
        : ("not-production-ready" as const),
    ncuaComplianceClaimPermitted: false as const,
    blockers: [...new Set(blockers)],
  };
}
