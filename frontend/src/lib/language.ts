// Central source of user-facing status/labels for RealDoor.
// Prohibited words (never render): eligible, ineligible, approved, denied,
// ranked, likely. This module is the only sanctioned place to derive
// user-facing decision language.

export const DECISION_BOUNDARY = {
  calculation: "This comparison is not an eligibility decision.",
  readiness: "A qualified human and program make any determination.",
  general:
    "RealDoor prepares a packet for human review. It does not make any determination about your housing application.",
} as const;

export function comparisonLabel(comparison: string | undefined): string {
  switch (comparison) {
    case "below_or_equal":
      return "At or below the threshold for this household size";
    case "above":
      return "Above the threshold for this household size";
    default:
      return "Comparison not available";
  }
}

export const READINESS_LABEL = {
  READY_TO_REVIEW: "Ready to send for review",
  NEEDS_REVIEW: "Needs your attention before review",
} as const;

export const REASON_CODE_MESSAGES: Record<string, string> = {
  PAY_STUB_TOTAL_CONFLICT:
    "Pay-stub totals conflict and need a person to review them.",
  MISSING_ID_DOCUMENT: "An identity document is missing from your packet.",
  HOUSEHOLD_SIZE_UNCONFIRMED:
    "Your household size hasn't been confirmed yet.",
  UNCONFIRMED_INCOME_FIELD:
    "One or more income fields haven't been confirmed yet.",
};
