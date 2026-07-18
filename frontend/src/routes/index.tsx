import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Disclaimer } from "@/components/disclaimer";
import { DECISION_BOUNDARY } from "@/lib/language";
import { IS_MOCK } from "@/lib/api/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealDoor — Prepare your affordable housing packet" },
      {
        name: "description",
        content:
          "A calm, guided walkthrough that helps you prepare an application-readiness packet for a person to review.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const [consent, setConsent] = useState(false);
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        RealDoor
      </p>
      <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
        Prepare a clear packet for a person to review.
      </h1>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        RealDoor guides you through your documents, extracts a small set of
        allowlisted values, and lets you confirm or correct each one. When you
        are done, you download a packet you can share with a housing program.
      </p>

      <div className="mt-8 space-y-4">
        <Disclaimer>{DECISION_BOUNDARY.general}</Disclaimer>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg text-foreground">What we do</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Read a fixed list of fields from your documents.</li>
            <li>• Show you where each value came from.</li>
            <li>• Let you confirm, correct, or leave a field for a person to review.</li>
            <li>• Build a packet you control and can delete at any time.</li>
          </ul>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
          <Checkbox
            id="consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <span className="leading-relaxed text-foreground">
            I understand this is a demo. RealDoor prepares a packet for human
            review and does not make any determination about my application. I
            consent to processing the demo documents in this browser session.
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {IS_MOCK ? (
            <span className="text-xs text-muted-foreground">
              Running in demo mode with sample data.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Connected to backend.</span>
          )}
          <Button
            disabled={!consent}
            onClick={() => navigate({ to: "/select-household" })}
            size="lg"
          >
            Continue
          </Button>
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        <Link to="/" className="underline underline-offset-4">
          RealDoor
        </Link>{" "}
        • Application readiness, not eligibility.
      </p>
    </main>
  );
}
