import type {
  DemoState,
  Vendor,
  VendorQuote,
} from "@/demo/model";

export interface EligibilityResult {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
}

export interface VendorScoreFactor {
  key:
    | "landedCost"
    | "contractStatus"
    | "delivery"
    | "performance"
    | "serviceHistory"
    | "strategicCriteria";
  label: string;
  weight: number;
  score: number;
  contribution: number;
  evidence: string;
}

export interface VendorEvaluation {
  vendor: Vendor;
  quote: VendorQuote;
  eligibility: EligibilityResult;
  score: number | null;
  factors: VendorScoreFactor[];
  confidence: "high" | "moderate" | "low";
}

const baseWeights = {
  landedCost: 30,
  contractStatus: 20,
  delivery: 15,
  performance: 15,
  serviceHistory: 10,
  strategicCriteria: 10,
} as const;

function onOrBefore(left: string, right: string) {
  return left.localeCompare(right) <= 0;
}

export function evaluateVendorEligibility(
  vendor: Vendor,
  quote: VendorQuote,
  requiredDate: string,
  asOfDate: string,
): EligibilityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (vendor.riskTier === "high") blockers.push("High supplier risk");
  if (vendor.documentationStatus === "incomplete") {
    blockers.push("Required documentation is incomplete");
  }
  if (vendor.sanctionsStatus === "possible_match") {
    blockers.push("Possible sanctions or debarment match");
  }
  if (vendor.conflictOfInterestStatus === "undisclosed") {
    blockers.push("Undisclosed conflict of interest");
  }
  if (vendor.w9Status === "missing") blockers.push("Required W-9 is missing");
  if (
    vendor.insuranceRequired &&
    !onOrBefore(asOfDate, vendor.insuranceExpiration)
  ) {
    blockers.push("Required insurance has expired");
  }
  if (
    vendor.cybersecurityReviewRequired &&
    vendor.cybersecurityReviewStatus !== "current"
  ) {
    blockers.push("Required cybersecurity review is not current");
  }
  if (vendor.onboardingStatus === "incomplete") {
    blockers.push("Supplier onboarding is incomplete");
  }
  if (vendor.complianceHold) blockers.push("Supplier has a compliance hold");
  if (vendor.criticalCorrectiveAction) {
    blockers.push("Critical corrective action remains unresolved");
  }
  if (!onOrBefore(asOfDate, quote.expirationDate)) {
    blockers.push("Quote has expired");
  }
  if (!onOrBefore(quote.deliveryDate, requiredDate)) {
    blockers.push("Delivery date does not meet the business requirement");
  }
  if (vendor.riskTier === "moderate") warnings.push("Moderate supplier risk");
  if (vendor.documentationStatus === "review_due") {
    warnings.push(`Documentation review due ${vendor.nextReviewDate}`);
  }
  if (vendor.contractStatus === "expiring") {
    warnings.push("Current agreement is approaching expiration");
  }
  return { eligible: blockers.length === 0, blockers, warnings };
}

function factor(
  key: VendorScoreFactor["key"],
  label: string,
  weight: number,
  score: number,
  evidence: string,
): VendorScoreFactor {
  return {
    key,
    label,
    weight,
    score: Math.round(score * 10) / 10,
    contribution: Math.round(weight * score) / 100,
    evidence,
  };
}

export function evaluateVendorQuotes(
  state: DemoState,
  requestId = state.featuredRequestId,
  strategicPolicyEnabled = false,
): VendorEvaluation[] {
  const request = state.requests.find((candidate) => candidate.id === requestId);
  if (!request) return [];
  const candidates = state.quotes
    .filter((quote) => quote.requestId === requestId)
    .map((quote) => {
      const vendor = state.vendors.find((candidate) => candidate.id === quote.vendorId);
      if (!vendor) return null;
      return {
        quote,
        vendor,
        eligibility: evaluateVendorEligibility(
          vendor,
          quote,
          request.requiredDate,
          state.sessionDate,
        ),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const eligibleTotals = candidates
    .filter((candidate) => candidate.eligibility.eligible)
    .map((candidate) => candidate.quote.totalCents);
  const lowestEligibleTotal = Math.min(...eligibleTotals);
  const activeWeight = strategicPolicyEnabled ? 100 : 90;

  return candidates
    .map(({ vendor, quote, eligibility }): VendorEvaluation => {
      if (!eligibility.eligible) {
        return {
          vendor,
          quote,
          eligibility,
          score: null,
          factors: [],
          confidence: "high",
        };
      }
      const normalizedWeight = (value: number) => (value / activeWeight) * 100;
      const deliveryDaysEarly = Math.max(
        0,
        Math.round(
          (new Date(`${request.requiredDate}T12:00:00Z`).getTime() -
            new Date(`${quote.deliveryDate}T12:00:00Z`).getTime()) /
            86_400_000,
        ),
      );
      const contractScore =
        quote.contractPricing && vendor.contractStatus === "active"
          ? 100
          : quote.contractPricing
            ? 75
            : 40;
      const factors = [
        factor(
          "landedCost",
          "Total landed cost",
          normalizedWeight(baseWeights.landedCost),
          (lowestEligibleTotal / quote.totalCents) * 100,
          `$${(quote.totalCents / 100).toLocaleString("en-US")} landed cost`,
        ),
        factor(
          "contractStatus",
          "Contract status",
          normalizedWeight(baseWeights.contractStatus),
          contractScore,
          quote.contractPricing
            ? `${vendor.contractStatus} contract pricing`
            : "Quote is not under contract",
        ),
        factor(
          "delivery",
          "Delivery",
          normalizedWeight(baseWeights.delivery),
          Math.min(100, 80 + deliveryDaysEarly * 4),
          `${deliveryDaysEarly} calendar days before required date`,
        ),
        factor(
          "performance",
          "Performance",
          normalizedWeight(baseWeights.performance),
          vendor.performanceScore,
          `${vendor.performanceScore}/100 supplier performance`,
        ),
        factor(
          "serviceHistory",
          "Service history",
          normalizedWeight(baseWeights.serviceHistory),
          vendor.serviceHistoryScore,
          `${vendor.serviceHistoryScore}/100 service history`,
        ),
      ];
      if (strategicPolicyEnabled) {
        factors.push(
          factor(
            "strategicCriteria",
            "Approved strategic criteria",
            baseWeights.strategicCriteria,
            vendor.strategicCriteriaScore,
            `${vendor.strategicCriteriaScore}/100 against enabled policy`,
          ),
        );
      }
      return {
        vendor,
        quote,
        eligibility,
        score: Math.round(
          factors.reduce(
            (total, candidate) => total + candidate.contribution,
            0,
          ),
        ),
        factors,
        confidence:
          eligibility.warnings.length === 0 ? "high" : "moderate",
      };
    })
    .sort((left, right) => {
      if (left.eligibility.eligible !== right.eligibility.eligible) {
        return left.eligibility.eligible ? -1 : 1;
      }
      return (right.score ?? -1) - (left.score ?? -1);
    });
}

export function recommendedVendorEvaluation(state: DemoState) {
  return evaluateVendorQuotes(state).find(
    (evaluation) => evaluation.eligibility.eligible,
  );
}
