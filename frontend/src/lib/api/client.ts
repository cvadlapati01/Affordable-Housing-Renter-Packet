import type {
  Calculation,
  CreateSessionResponse,
  DemoHousehold,
  DocumentCard,
  Packet,
  Profile,
  ProfileField,
  Readiness,
} from "./types";
import {
  DEMO_HOUSEHOLDS,
  calculationFor,
  documentsFor,
  profileFor,
  readinessFor,
} from "./mock-data";

const BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const USE_MOCK = !BASE || BASE.trim() === "";

async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { "X-Session-Token": opts.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

// --- Simple in-memory mock store (per browser tab) ---
type MockSessionState = {
  session_id: string;
  session_token: string;
  demo_household_id: string;
  documentsLoaded: boolean;
  extracted: boolean;
  documents: DocumentCard[];
  profile: Profile;
  packet?: Packet;
};

const mockStore = new Map<string, MockSessionState>();
const liveDocumentStore = new Map<string, DocumentCard[]>();

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- API functions ---

export async function getDemoHouseholds(): Promise<DemoHousehold[]> {
  if (USE_MOCK) {
    await delay(200);
    return DEMO_HOUSEHOLDS;
  }
  return req<DemoHousehold[]>("/demo-households");
}

export async function createSession(input: {
  demo_household_id: string;
  consent: boolean;
}): Promise<CreateSessionResponse> {
  if (USE_MOCK) {
    await delay(300);
    const session_id = `sess-${crypto.randomUUID()}`;
    const session_token = `tok-${crypto.randomUUID()}`;
    mockStore.set(session_id, {
      session_id,
      session_token,
      demo_household_id: input.demo_household_id,
      documentsLoaded: false,
      extracted: false,
      documents: documentsFor(input.demo_household_id),
      profile: profileFor(input.demo_household_id),
    });
    return {
      session_id,
      session_token,
      expires_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
      next_action: "extract_documents",
    };
  }
  return req<CreateSessionResponse>("/sessions", { method: "POST", body: input });
}

export async function loadDemoDocuments(sessionId: string, token: string) {
  if (USE_MOCK) {
    await delay(400);
    const s = mockStore.get(sessionId);
    if (s) {
      s.documentsLoaded = true;
      s.documents = s.documents.map((d) => ({ ...d, status: "processing" as const }));
    }
    return { ok: true };
  }
  const response = await req<{ documents: Array<Record<string, unknown>> }>(
    `/sessions/${sessionId}/documents/load-demo`,
    { method: "POST", token },
  );
  liveDocumentStore.set(sessionId, response.documents.map(toDocumentCard));
  return { ok: true };
}

export async function extractDocuments(
  sessionId: string,
  token: string,
): Promise<{ documents: DocumentCard[] }> {
  if (USE_MOCK) {
    await delay(1200);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    s.extracted = true;
    s.documents = s.documents.map((d) => {
      const needs =
        s.demo_household_id === "HH-006" && d.document_type === "Pay stub";
      return {
        ...d,
        status: needs ? "needs_review" : "extracted",
        extracted_field_count: d.document_type === "Pay stub" ? 2 : d.document_type === "State ID" ? 2 : 1,
      };
    });
    return { documents: s.documents };
  }
  const response = await req<{ fields: Array<{ evidence?: Array<{ document_id: string }> }> }>(
    `/sessions/${sessionId}/documents/extract`,
    { method: "POST", token },
  );
  const counts = new Map<string, number>();
  response.fields.forEach((field) => field.evidence?.forEach((e) => {
    counts.set(e.document_id, (counts.get(e.document_id) ?? 0) + 1);
  }));
  const documents = (liveDocumentStore.get(sessionId) ?? []).map((document) => ({
    ...document,
    status: "extracted" as const,
    extracted_field_count: counts.get(document.document_id) ?? 0,
  }));
  liveDocumentStore.set(sessionId, documents);
  return { documents };
}

export async function getDocuments(
  sessionId: string,
  token: string,
): Promise<{ documents: DocumentCard[] }> {
  if (USE_MOCK) {
    await delay(100);
    const s = mockStore.get(sessionId);
    return { documents: s?.documents ?? [] };
  }
  const cached = liveDocumentStore.get(sessionId);
  if (cached) return { documents: cached };
  const response = await req<Array<Record<string, unknown>>>(`/sessions/${sessionId}/documents`, { token });
  const documents = response.map(toDocumentCard);
  liveDocumentStore.set(sessionId, documents);
  return { documents };
}

export async function getProfile(sessionId: string, token: string): Promise<Profile> {
  if (USE_MOCK) {
    await delay(150);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    return s.profile;
  }
  const response = await req<{ fields: Array<Record<string, unknown>> }>(`/sessions/${sessionId}/profile`, { token });
  return toProfile(sessionId, response.fields);
}

export async function patchProfileField(
  sessionId: string,
  fieldId: string,
  token: string,
  input: { value: string | number; reason?: string },
): Promise<ProfileField> {
  if (USE_MOCK) {
    await delay(200);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    const f = s.profile.fields.find((x) => x.field_id === fieldId);
    if (!f) throw new Error("Field not found");
    f.value = input.value;
    f.confirmed_value = input.value;
    f.state = "corrected";
    f.correction_reason = input.reason;
    s.profile.unresolved_count = s.profile.fields.filter((x) => x.state === "extracted" || x.state === "needs_review").length;
    return f;
  }
  return req<ProfileField>(`/sessions/${sessionId}/profile/fields/${fieldId}`, {
    method: "PATCH",
    body: input,
    token,
  });
}

export async function confirmProfileFields(
  sessionId: string,
  token: string,
  input: { field_ids: string[] },
): Promise<Profile> {
  if (USE_MOCK) {
    await delay(200);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    s.profile.fields.forEach((f) => {
      if (input.field_ids.includes(f.field_id)) {
        f.state = "confirmed";
        f.confirmed_value = f.value;
      }
    });
    s.profile.unresolved_count = s.profile.fields.filter((x) => x.state === "extracted" || x.state === "needs_review").length;
    return s.profile;
  }
  await req(`/sessions/${sessionId}/profile/confirm`, {
    method: "POST",
    body: input,
    token,
  });
  return getProfile(sessionId, token);
}

export async function runCalculation(sessionId: string, token: string): Promise<Calculation> {
  if (USE_MOCK) {
    await delay(300);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    return calculationFor(s.profile);
  }
  const response = await req<Record<string, unknown>>(`/sessions/${sessionId}/calculation`, { method: "POST", token });
  return {
    ...response,
    income_sources: [],
    household_size: 0,
    citations: ((response.citations as Array<Record<string, unknown>>) ?? []).map((citation) => ({
      ...citation,
      authority: "Fictional public demo rules",
    })),
  } as Calculation;
}

export async function evaluateReadiness(sessionId: string, token: string): Promise<Readiness> {
  if (USE_MOCK) {
    await delay(300);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    return readinessFor(s.demo_household_id, s.profile);
  }
  const response = await req<Readiness>(`/sessions/${sessionId}/readiness/evaluate`, { method: "POST", token });
  return { ...response, document_checks: [] };
}

export async function createPacket(sessionId: string, token: string): Promise<Packet> {
  if (USE_MOCK) {
    await delay(400);
    const s = mockStore.get(sessionId);
    if (!s) throw new Error("Session not found");
    const calc = calculationFor(s.profile);
    const readiness = readinessFor(s.demo_household_id, s.profile);
    const identity: Record<string, string | number | null> = {};
    const household: Record<string, string | number | null> = {};
    s.profile.fields.forEach((f) => {
      if (f.group === "identity") identity[f.label] = f.value;
      if (f.group === "household") household[f.label] = f.value;
    });
    const packet: Packet = {
      packet_id: `pkt-${crypto.randomUUID()}`,
      version: 1,
      created_at: new Date().toISOString(),
      json: {
        identity,
        household,
        income: calc.income_sources,
        calculation: calc,
        readiness,
        citations: calc.citations,
        renter_notes: "",
      },
    };
    s.packet = packet;
    return packet;
  }
  const response = await req<Record<string, unknown>>(`/sessions/${sessionId}/packets`, { method: "POST", token });
  return {
    packet_id: String(response.packet_id),
    version: 1,
    created_at: new Date().toISOString(),
    json: {
      identity: {}, household: {}, income: [],
      calculation: response.calculation as Calculation,
      readiness: { ...(response.readiness as Readiness), document_checks: [] },
      citations: ((response.calculation as Calculation).citations ?? []),
      renter_notes: "",
    },
  };
}

export async function deleteSession(sessionId: string, token: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200);
    mockStore.delete(sessionId);
    return;
  }
  await req(`/sessions/${sessionId}`, { method: "DELETE", token });
  liveDocumentStore.delete(sessionId);
}

function toDocumentCard(document: Record<string, unknown>): DocumentCard {
  return {
    document_id: String(document.document_id),
    file_name: String(document.file_name),
    document_type: String(document.document_type).replaceAll("_", " "),
    status: "processing",
    is_synthetic: true,
    page_count: 1,
  };
}

function toProfile(sessionId: string, fields: Array<Record<string, unknown>>): Profile {
  return {
    session_id: sessionId,
    unresolved_count: fields.filter((field) => field.state === "extracted").length,
    fields: fields.map((field) => {
      const name = String(field.name);
      return {
        ...field,
        value: field.confirmed_value ?? field.extracted_value,
        label: name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        group: ["household_size"].includes(name) ? "household" : "income",
        evidence: field.evidence ?? [],
      } as ProfileField;
    }),
  };
}

export const IS_MOCK = USE_MOCK;
