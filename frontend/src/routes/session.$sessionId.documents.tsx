import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractDocuments, getDocuments } from "@/lib/api/client";
import { readSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";
import type { DocumentStatus } from "@/lib/api/types";

export const Route = createFileRoute("/session/$sessionId/documents")({
  head: () => ({ meta: [{ title: "Documents — RealDoor" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = readSession()?.session_token ?? "";

  const docs = useQuery({
    queryKey: ["documents", sessionId],
    queryFn: () => getDocuments(sessionId, token),
  });

  const extract = useMutation({
    mutationFn: () => extractDocuments(sessionId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", sessionId] }),
  });

  const documents = docs.data?.documents ?? [];
  const anyExtracted = documents.some((d) => d.status === "extracted" || d.status === "needs_review");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-foreground">Your documents</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        These are the documents attached to your session. Run extraction to
        read a small set of allowlisted values from each one.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Disclaimer>
          RealDoor reads only fields on a fixed list. It never infers anything
          not on that list.
        </Disclaimer>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => extract.mutate()}
          disabled={extract.isPending || anyExtracted}
        >
          {extract.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading documents…
            </>
          ) : anyExtracted ? (
            "Extraction complete"
          ) : (
            "Run extraction"
          )}
        </Button>
      </div>

      <ul className="mt-6 space-y-3" aria-live="polite">
        {documents.map((d) => (
          <li
            key={d.document_id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{d.file_name}</p>
                <StatusChip status={extract.isPending ? "processing" : d.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {d.document_type} • {d.page_count} page
                {d.page_count === 1 ? "" : "s"}
                {typeof d.extracted_field_count === "number"
                  ? ` • ${d.extracted_field_count} field${d.extracted_field_count === 1 ? "" : "s"} read`
                  : ""}
              </p>
            </div>
          </li>
        ))}
        {documents.length === 0 && !docs.isLoading ? (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No documents attached yet.
          </li>
        ) : null}
      </ul>

      <div className="mt-10 flex justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: "/select-household" })}>
          Change household
        </Button>
        <Button
          disabled={!anyExtracted}
          onClick={() =>
            navigate({
              to: "/session/$sessionId/profile",
              params: { sessionId },
            })
          }
        >
          Continue to profile review
        </Button>
      </div>
    </main>
  );
}

function StatusChip({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { label: string; className: string; Icon: typeof FileText }> = {
    loading: {
      label: "Loading",
      className: "bg-muted text-muted-foreground",
      Icon: Loader2,
    },
    processing: {
      label: "Reading",
      className: "bg-muted text-muted-foreground",
      Icon: Loader2,
    },
    extracted: {
      label: "Fields read",
      className: "bg-accent/20 text-foreground",
      Icon: CheckCircle2,
    },
    needs_review: {
      label: "Needs review",
      className: "bg-warning/25 text-foreground",
      Icon: AlertCircle,
    },
  };
  const { label, className, Icon } = map[status];
  return (
    <Badge className={`gap-1 rounded-full border-0 ${className}`} variant="secondary">
      <Icon className={`h-3 w-3 ${status === "loading" || status === "processing" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}
