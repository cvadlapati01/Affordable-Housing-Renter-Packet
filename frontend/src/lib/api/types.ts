export type DemoHousehold = {
  household_id: string;
  household_size?: number;
  city?: string;
  state?: string;
  description?: string;
  document_count?: number;
};

export type CreateSessionResponse = {
  session_id: string;
  session_token: string;
  expires_at: string;
  next_action: string;
};

export type DocumentStatus = "loading" | "processing" | "extracted" | "needs_review";

export type BBox = [number, number, number, number];

export type EvidenceRef = {
  document_id: string;
  document_name?: string;
  page: number;
  bbox: BBox;
  bbox_units: "pdf_points_bottom_left_origin";
  excerpt?: string;
};

export type DocumentCard = {
  document_id: string;
  file_name: string;
  document_type: string;
  status: DocumentStatus;
  is_synthetic: boolean;
  page_count: number;
  extracted_field_count?: number;
};

export type FieldConfidence = "high" | "medium" | "low";
export type FieldState = "extracted" | "confirmed" | "corrected" | "needs_review";

export type ProfileField = {
  field_id: string;
  name: string;
  label: string;
  group: "identity" | "household" | "income";
  value: string | number | null;
  extracted_value: string | number | null;
  confirmed_value?: string | number | null;
  unit?: string;
  confidence: FieldConfidence;
  state: FieldState;
  evidence: EvidenceRef[];
  correction_reason?: string;
};

export type Profile = {
  session_id: string;
  fields: ProfileField[];
  unresolved_count: number;
};

export type Citation = {
  rule_id: string;
  authority: string;
  effective_date: string;
  source_url: string;
  source_locator: string;
};

export type Calculation = {
  income_sources: { label: string; value: number; period: string }[];
  annualized_income: number;
  threshold: number;
  comparison: "below_or_equal" | "above";
  formula: string;
  effective_date: string;
  household_size: number;
  citations: Citation[];
  decision_boundary: string;
};

export type ReadinessStatus = "READY_TO_REVIEW" | "NEEDS_REVIEW";

export type ReadinessReason = {
  code: string;
  message: string;
  document_ids?: string[];
};

export type Readiness = {
  status: ReadinessStatus;
  reason_codes: string[];
  reasons: ReadinessReason[];
  document_checks: { name: string; ok: boolean }[];
  decision_boundary: string;
};

export type Packet = {
  packet_id: string;
  version: number;
  created_at: string;
  json: {
    identity: Record<string, string | number | null>;
    household: Record<string, string | number | null>;
    income: { label: string; value: number; period: string }[];
    calculation: Calculation;
    readiness: Readiness;
    citations: Citation[];
    renter_notes: string;
  };
};

export type ApiError = {
  error: { code: string; message: string; details?: unknown[] };
};
