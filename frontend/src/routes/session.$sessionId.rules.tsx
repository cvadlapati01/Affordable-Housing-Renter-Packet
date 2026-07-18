import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runCalculation } from "@/lib/api/client";
import { readSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";
import { DECISION_BOUNDARY, comparisonLabel } from "@/lib/language";

export const Route = createFileRoute("/session/$sessionId/rules")({
  head: () => ({ meta: [{ title: "Income calculation — RealDoor" }] }),
  component: RulesPage,
});

function RulesPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const token = readSession()?.session_token ?? "";

  const calc = useMutation({
    mutationFn: () => runCalculation(sessionId, token),
  });

  useEffect(() => {
    calc.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = calc.data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl text-foreground">
        How your income is calculated
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        RealDoor uses only the values you confirmed. Nothing here is a
        decision — it's arithmetic and a citation you can check.
      </p>

      {calc.isPending && !c ? (
        <div className="mt-8 h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : c ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Formula
            </p>
            <p className="mt-2 font-display text-2xl text-foreground">
              {c.formula}
            </p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Annualized income</dt>
                <dd className="font-display text-lg text-foreground">
                  ${c.annualized_income.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Threshold (household size {c.household_size})
                </dt>
                <dd className="font-display text-lg text-foreground">
                  ${c.threshold.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Comparison</dt>
                <dd className="text-foreground">{comparisonLabel(c.comparison)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Effective date</dt>
                <dd className="text-foreground">{c.effective_date}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Citation
            </p>
            {c.citations.map((cite) => (
              <div key={cite.rule_id} className="mt-3 space-y-1 text-sm">
                <p className="font-medium text-foreground">{cite.authority}</p>
                <p className="text-muted-foreground">
                  Rule {cite.rule_id} • Effective {cite.effective_date} •{" "}
                  {cite.source_locator}
                </p>
                <a
                  href={cite.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </section>

          <Disclaimer>{DECISION_BOUNDARY.calculation}</Disclaimer>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                navigate({
                  to: "/session/$sessionId/readiness",
                  params: { sessionId },
                })
              }
            >
              Continue
            </Button>
          </div>
        </div>
      ) : calc.isError ? (
        <p className="mt-6 text-sm text-destructive">
          {(calc.error as Error).message}
        </p>
      ) : null}
    </main>
  );
}
