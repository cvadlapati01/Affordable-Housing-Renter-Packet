import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSession,
  getDemoHouseholds,
  loadDemoDocuments,
} from "@/lib/api/client";
import { saveSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";

export const Route = createFileRoute("/select-household")({
  head: () => ({
    meta: [
      { title: "Choose a demo household — RealDoor" },
      {
        name: "description",
        content: "Pick a sample household to walk through the RealDoor readiness flow.",
      },
    ],
  }),
  component: SelectHousehold,
});

function SelectHousehold() {
  const { data, isLoading } = useQuery({
    queryKey: ["demo-households"],
    queryFn: getDemoHouseholds,
  });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async (householdId: string) => {
      const sess = await createSession({
        demo_household_id: householdId,
        consent: true,
      });
      saveSession({
        session_id: sess.session_id,
        session_token: sess.session_token,
        demo_household_id: householdId,
        expires_at: sess.expires_at,
      });
      await loadDemoDocuments(sess.session_id, sess.session_token);
      return sess.session_id;
    },
    onSuccess: (sessionId) => {
      navigate({
        to: "/session/$sessionId/documents",
        params: { sessionId },
      });
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 font-display text-3xl text-foreground">
        Choose a demo household
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Scope: Boston–Cambridge–Quincy MSA, FY 2026 frozen rules, six
        synthetic households. Details load from the backend — nothing here
        is real applicant data.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border border-border bg-muted/40"
              />
            ))
          : data?.map((h) => (
              <button
                key={h.household_id}
                onClick={() => setSelected(h.household_id)}
                className={`text-left rounded-lg border p-5 transition-all hover:border-foreground/40 hover:shadow-sm ${
                  selected === h.household_id
                    ? "border-foreground bg-card ring-2 ring-ring/40"
                    : "border-border bg-card"
                }`}
                aria-pressed={selected === h.household_id}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {h.household_id}
                  </span>
                  {h.household_size != null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> Size {h.household_size}
                    </span>
                  ) : null}
                </div>
                {h.city || h.state ? (
                  <div className="mt-3 font-display text-lg text-foreground">
                    {[h.city, h.state].filter(Boolean).join(", ")}
                  </div>
                ) : null}
                {h.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>
                ) : null}
                {h.document_count != null ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {h.document_count} documents
                  </p>
                ) : null}
              </button>
            ))}
      </div>

      <div className="mt-8 space-y-4">
        <Disclaimer>
          Selecting a household starts a private session in your browser. You
          can delete it at any time from the packet screen.
        </Disclaimer>
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!selected || start.isPending}
            onClick={() => selected && start.mutate(selected)}
          >
            {start.isPending ? "Starting session…" : "Start session"}
          </Button>
        </div>
        {start.isError ? (
          <p className="text-sm text-destructive">
            {(start.error as Error).message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
