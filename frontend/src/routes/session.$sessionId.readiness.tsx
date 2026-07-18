import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { evaluateReadiness } from "@/lib/api/client";
import { readSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";
import { DECISION_BOUNDARY, READINESS_LABEL, REASON_CODE_MESSAGES } from "@/lib/language";

export const Route = createFileRoute("/session/$sessionId/readiness")({
  head: () => ({ meta: [{ title: "Readiness — RealDoor" }] }),
  component: ReadinessPage,
});

function ReadinessPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const token = readSession()?.session_token ?? "";

  const evalReadiness = useMutation({
    mutationFn: () => evaluateReadiness(sessionId, token),
  });

  useEffect(() => {
    evalReadiness.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = evalReadiness.data;
  const ready = r?.status === "READY_TO_REVIEW";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl text-foreground">Readiness</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        This tells you whether your packet is ready to send to a person for
        review, or whether something still needs your attention.
      </p>

      {!r ? (
        <div className="mt-8 h-48 animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : (
        <div className="mt-8 space-y-6" aria-live="polite">
          <section
            className={`rounded-lg border p-6 ${
              ready
                ? "border-accent bg-accent/10"
                : "border-warning bg-warning/15"
            }`}
          >
            <div className="flex items-center gap-3">
              {ready ? (
                <CheckCircle2 className="h-6 w-6 text-foreground" aria-hidden />
              ) : (
                <AlertCircle className="h-6 w-6 text-foreground" aria-hidden />
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                <p className="font-display text-2xl text-foreground">
                  {r.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  {READINESS_LABEL[r.status]}
                </p>
              </div>
            </div>
          </section>

          {r.reasons.length > 0 ? (
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-lg text-foreground">
                What to look at
              </h2>
              <ul className="mt-3 space-y-3">
                {r.reasons.map((reason) => (
                  <li key={reason.code} className="text-sm">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {reason.code}
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {REASON_CODE_MESSAGES[reason.code] ?? reason.message}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {r.document_checks?.length ? (
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-lg text-foreground">Checks</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {r.document_checks.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground" aria-hidden />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-foreground" aria-hidden />
                    )}
                    <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                      {c.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Disclaimer>{DECISION_BOUNDARY.readiness}</Disclaimer>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() =>
                navigate({
                  to: "/session/$sessionId/profile",
                  params: { sessionId },
                })
              }
            >
              Back to profile
            </Button>
            <Button
              onClick={() =>
                navigate({
                  to: "/session/$sessionId/packet",
                  params: { sessionId },
                })
              }
            >
              Continue to packet
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
