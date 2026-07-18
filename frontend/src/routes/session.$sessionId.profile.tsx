import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Pencil, FileSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  confirmProfileFields,
  getProfile,
  patchProfileField,
} from "@/lib/api/client";
import { readSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";
import type { EvidenceRef, ProfileField } from "@/lib/api/types";

export const Route = createFileRoute("/session/$sessionId/profile")({
  head: () => ({ meta: [{ title: "Profile review — RealDoor" }] }),
  component: ProfilePage,
});

const GROUPS: {
  key: ProfileField["group"];
  label: string;
}[] = [
  { key: "identity", label: "Identity" },
  { key: "household", label: "Household" },
  { key: "income", label: "Income" },
];

function ProfilePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = readSession()?.session_token ?? "";
  const [viewing, setViewing] = useState<EvidenceRef | null>(null);

  const profile = useQuery({
    queryKey: ["profile", sessionId],
    queryFn: () => getProfile(sessionId, token),
  });

  const patch = useMutation({
    mutationFn: (v: { fieldId: string; value: string | number; reason: string }) =>
      patchProfileField(sessionId, v.fieldId, token, {
        value: v.value,
        reason: v.reason,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", sessionId] }),
  });

  const confirmAll = useMutation({
    mutationFn: (fieldIds: string[]) =>
      confirmProfileFields(sessionId, token, { field_ids: fieldIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", sessionId] }),
  });

  const fields = profile.data?.fields ?? [];
  const unresolved = fields.filter(
    (f) => f.state === "extracted" || f.state === "needs_review",
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-foreground">Review your profile</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Confirm what we read from your documents, or correct anything that
        doesn't match. Every value links to the exact place we found it.
      </p>

      <div className="mt-6">
        <Disclaimer>
          Confirmed values are what a reviewer will see in your packet. You can
          come back and change them before you download.
        </Disclaimer>
      </div>

      <div className="mt-8 space-y-8">
        {GROUPS.map((g) => {
          const groupFields = fields.filter((f) => f.group === g.key);
          if (!groupFields.length) return null;
          return (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <h2
                id={`group-${g.key}`}
                className="font-display text-xl text-foreground"
              >
                {g.label}
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                {groupFields.map((f) => (
                  <FieldRow
                    key={f.field_id}
                    field={f}
                    onOpenEvidence={setViewing}
                    onSave={(value, reason) =>
                      patch.mutate({ fieldId: f.field_id, value, reason })
                    }
                    onConfirm={() => confirmAll.mutate([f.field_id])}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {unresolved.length} field{unresolved.length === 1 ? "" : "s"} still to
          confirm
        </span>
        <div className="flex gap-2">
          {unresolved.length > 0 ? (
            <Button
              variant="outline"
              onClick={() =>
                confirmAll.mutate(unresolved.map((f) => f.field_id))
              }
              disabled={confirmAll.isPending}
            >
              Confirm all remaining
            </Button>
          ) : null}
          <Button
            onClick={() =>
              navigate({
                to: "/session/$sessionId/rules",
                params: { sessionId },
              })
            }
          >
            Continue
          </Button>
        </div>
      </div>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Source</SheetTitle>
            <SheetDescription>
              Where this value was read from in your document.
            </SheetDescription>
          </SheetHeader>
          {viewing ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Document
                </p>
                <p className="font-medium text-foreground">
                  {viewing.document_name ?? viewing.document_id}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Page
                </p>
                <p className="text-foreground">{viewing.page}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Excerpt
                </p>
                <blockquote className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                  {viewing.excerpt ?? "—"}
                </blockquote>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Location (PDF points)
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  [{viewing.bbox.join(", ")}]
                </p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function FieldRow({
  field,
  onOpenEvidence,
  onSave,
  onConfirm,
}: {
  field: ProfileField;
  onOpenEvidence: (e: EvidenceRef) => void;
  onSave: (value: string | number, reason: string) => void;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(field.value ?? ""));
  const [reason, setReason] = useState("");

  const stateBadge = (() => {
    switch (field.state) {
      case "confirmed":
        return (
          <Badge className="gap-1 border-0 bg-accent/20 text-foreground">
            <Check className="h-3 w-3" /> Confirmed
          </Badge>
        );
      case "corrected":
        return (
          <Badge className="border-0 bg-accent/20 text-foreground">Corrected</Badge>
        );
      case "needs_review":
        return (
          <Badge className="border-0 bg-warning/25 text-foreground">Needs review</Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not confirmed
          </Badge>
        );
    }
  })();

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{field.label}</p>
            {stateBadge}
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {field.confidence} confidence
            </span>
          </div>
          {!editing ? (
            <p className="mt-1 font-display text-lg text-foreground">
              {formatValue(field)}
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`New value for ${field.label}`}
              />
              <Input
                placeholder="Reason for correction (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Reason for correction"
              />
            </div>
          )}
          {field.evidence.length > 0 ? (
            <button
              onClick={() => onOpenEvidence(field.evidence[0])}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              <FileSearch className="h-3 w-3" /> View source
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  onSave(value, reason);
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setValue(String(field.value ?? ""));
                  setEditing(false);
                }}
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${field.label}`}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Edit</span>
              </Button>
              {field.state !== "confirmed" ? (
                <Button size="sm" onClick={onConfirm}>
                  Confirm
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function formatValue(f: ProfileField): string {
  if (f.value === null || f.value === undefined || f.value === "") return "—";
  if (f.name === "gross_pay") return `$${Number(f.value).toFixed(2)}`;
  return String(f.value);
}
