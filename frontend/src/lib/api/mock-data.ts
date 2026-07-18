import type {
  Calculation,
  Citation,
  DemoHousehold,
  DocumentCard,
  Profile,
  Readiness,
} from "./types";

// NOTE: The backend is the source of truth for demo household data.
// These placeholders exist only so the flow renders when VITE_API_BASE_URL
// is not configured. Scope is strictly the Boston–Cambridge–Quincy MSA,
// FY 2026 frozen rules, and the six supplied synthetic households.
// Only household_id and the fallback household_size are provided here;
// city/state/description come from the backend.
export const DEMO_HOUSEHOLDS: DemoHousehold[] = [
  { household_id: "HH-001", household_size: 1 },
  { household_id: "HH-002", household_size: 2 },
  { household_id: "HH-003", household_size: 3 },
  { household_id: "HH-004", household_size: 4 },
  { household_id: "HH-005", household_size: 5 },
  { household_id: "HH-006", household_size: 6 },
];

const CITATION_HUD: Citation = {
  rule_id: "HUD-MTSP-002",
  authority: "HUD Multifamily Tax Subsidy Projects Income Limits, FY26",
  effective_date: "2026-05-01",
  source_url:
    "https://www.huduser.gov/portal/datasets/mtsp/mtsp26/HERA-Income-Limits-Report-FY26.pdf",
  source_locator: "PDF page 130",
};

// Frozen 60% AMI thresholds by household size (illustrative, from HUD MTSP-style figures).
const THRESHOLD_BY_SIZE: Record<number, number> = {
  1: 72000,
  2: 82320,
  3: 92640,
  4: 102960,
  5: 111240,
  6: 119520,
  7: 127800,
  8: 136080,
};

export function documentsFor(householdId: string): DocumentCard[] {
  const map: Record<string, DocumentCard[]> = {
    "HH-001": [
      doc("d1-a", "state_id.pdf", "State ID"),
      doc("d1-b", "paystub_2026_06_15.pdf", "Pay stub"),
      doc("d1-c", "paystub_2026_06_29.pdf", "Pay stub"),
    ],
    "HH-002": [
      doc("d2-a", "state_id.pdf", "State ID"),
      doc("d2-b", "spouse_id.pdf", "State ID"),
      doc("d2-c", "w2_2025.pdf", "W-2"),
      doc("d2-d", "paystub_2026_06_15.pdf", "Pay stub"),
    ],
    "HH-003": [
      doc("d3-a", "state_id.pdf", "State ID"),
      doc("d3-b", "birth_certificate_child1.pdf", "Birth certificate"),
      doc("d3-c", "paystub_2026_06_29.pdf", "Pay stub"),
    ],
    "HH-004": [
      doc("d4-a", "state_id_a.pdf", "State ID"),
      doc("d4-b", "state_id_b.pdf", "State ID"),
      doc("d4-c", "w2_a_2025.pdf", "W-2"),
      doc("d4-d", "w2_b_2025.pdf", "W-2"),
    ],
    "HH-005": [
      doc("d5-a", "state_id.pdf", "State ID"),
      doc("d5-b", "ssa_benefits_letter.pdf", "Benefits letter"),
      doc("d5-c", "paystub_2026_06_29.pdf", "Pay stub"),
    ],
    "HH-006": [
      doc("d6-a", "state_id.pdf", "State ID"),
      doc("d6-b", "paystub_2026_06_15.pdf", "Pay stub"),
      doc("d6-c", "paystub_2026_06_29.pdf", "Pay stub"),
      doc("d6-d", "paystub_2026_07_13.pdf", "Pay stub"),
    ],
  };
  return map[householdId] ?? [];
}

function doc(id: string, name: string, type: string): DocumentCard {
  return {
    document_id: id,
    file_name: name,
    document_type: type,
    status: "loading",
    is_synthetic: false,
    page_count: type === "W-2" ? 2 : 1,
  };
}

export function profileFor(householdId: string): Profile {
  const hh = DEMO_HOUSEHOLDS.find((h) => h.household_id === householdId)!;
  const docs = documentsFor(householdId);
  const primaryDoc = docs[0];
  const stubDoc = docs.find((d) => d.document_type === "Pay stub") ?? docs[docs.length - 1];

  const identity = [
    field("f-name", "full_name", "Full legal name", "identity", "Alex Rivera", "high", [
      ev(primaryDoc.document_id, primaryDoc.file_name, 1, [140, 610, 320, 628], "ALEX RIVERA"),
    ]),
    field("f-dob", "date_of_birth", "Date of birth", "identity", "1991-04-12", "high", [
      ev(primaryDoc.document_id, primaryDoc.file_name, 1, [140, 580, 280, 598], "DOB 04/12/1991"),
    ]),
  ];

  const household = [
    field(
      "f-hh-size",
      "household_size",
      "Household size",
      "household",
      hh.household_size ?? 1,
      "high",
      [],
    ),
    field("f-city", "city", "City", "household", hh.city ?? "Boston", "high", []),
  ];

  const conflict = householdId === "HH-006";
  const income = [
    field(
      "f-gross",
      "gross_pay",
      "Gross pay (most recent stub)",
      "income",
      conflict ? 1180 : 960,
      conflict ? "low" : "high",
      [
        ev(stubDoc.document_id, stubDoc.file_name, 1, [340, 528, 397, 544], "Gross pay: $960.00"),
      ],
      conflict ? "needs_review" : "extracted",
    ),
    field(
      "f-period",
      "pay_period",
      "Pay period",
      "income",
      "weekly",
      "high",
      [ev(stubDoc.document_id, stubDoc.file_name, 1, [340, 500, 420, 516], "Pay period: WEEKLY")],
    ),
  ];

  const fields = [...identity, ...household, ...income];
  return {
    session_id: `mock-${householdId}`,
    fields,
    unresolved_count: fields.filter((f) => f.state !== "confirmed").length,
  };
}

function field(
  field_id: string,
  name: string,
  label: string,
  group: "identity" | "household" | "income",
  value: string | number,
  confidence: "high" | "medium" | "low",
  evidence: ReturnType<typeof ev>[],
  state: import("./types").FieldState = "extracted",
): import("./types").ProfileField {
  return {
    field_id,
    name,
    label,
    group,
    value,
    extracted_value: value,
    confidence,
    state,
    evidence,
  };
}

function ev(
  document_id: string,
  document_name: string,
  page: number,
  bbox: [number, number, number, number],
  excerpt: string,
) {
  return {
    document_id,
    document_name,
    page,
    bbox,
    bbox_units: "pdf_points_bottom_left_origin" as const,
    excerpt,
  };
}

export function calculationFor(profile: Profile): Calculation {
  const size = Number(profile.fields.find((f) => f.name === "household_size")?.value ?? 1);
  const gross = Number(profile.fields.find((f) => f.name === "gross_pay")?.value ?? 0);
  const period = String(profile.fields.find((f) => f.name === "pay_period")?.value ?? "weekly");
  const multiplier = period === "weekly" ? 52 : period === "biweekly" ? 26 : 12;
  const annualized = gross * multiplier;
  const threshold = THRESHOLD_BY_SIZE[size] ?? 82320;
  return {
    income_sources: [{ label: "Gross pay", value: gross, period }],
    annualized_income: annualized,
    threshold,
    comparison: annualized <= threshold ? "below_or_equal" : "above",
    formula: `$${gross.toFixed(2)} × ${multiplier} = $${annualized.toFixed(2)}`,
    effective_date: "2026-05-01",
    household_size: size,
    citations: [CITATION_HUD],
    decision_boundary: "This comparison is not an eligibility decision.",
  };
}

export function readinessFor(householdId: string, profile: Profile): Readiness {
  const conflict = householdId === "HH-006";
  const unconfirmed = profile.fields.filter(
    (f) => f.state === "extracted" || f.state === "needs_review",
  );
  if (conflict) {
    return {
      status: "NEEDS_REVIEW",
      reason_codes: ["PAY_STUB_TOTAL_CONFLICT"],
      reasons: [
        {
          code: "PAY_STUB_TOTAL_CONFLICT",
          message: "Pay-stub totals conflict and need human review.",
          document_ids: documentsFor(householdId).map((d) => d.document_id),
        },
      ],
      document_checks: [
        { name: "Identity document present", ok: true },
        { name: "Pay stubs consistent", ok: false },
      ],
      decision_boundary: "A qualified human and program make any determination.",
    };
  }
  if (unconfirmed.length > 0) {
    return {
      status: "NEEDS_REVIEW",
      reason_codes: ["UNCONFIRMED_INCOME_FIELD"],
      reasons: [
        {
          code: "UNCONFIRMED_INCOME_FIELD",
          message: "One or more fields haven't been confirmed yet.",
        },
      ],
      document_checks: [
        { name: "Identity document present", ok: true },
        { name: "All fields confirmed", ok: false },
      ],
      decision_boundary: "A qualified human and program make any determination.",
    };
  }
  return {
    status: "READY_TO_REVIEW",
    reason_codes: [],
    reasons: [],
    document_checks: [
      { name: "Identity document present", ok: true },
      { name: "Pay stubs consistent", ok: true },
      { name: "Household size confirmed", ok: true },
    ],
    decision_boundary: "A qualified human and program make any determination.",
  };
}
