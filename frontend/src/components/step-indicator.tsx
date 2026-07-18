import { Link, useLocation } from "@tanstack/react-router";
import { Check } from "lucide-react";

const STEPS = [
  { key: "documents", label: "Documents" },
  { key: "profile", label: "Profile" },
  { key: "rules", label: "Calculation" },
  { key: "readiness", label: "Readiness" },
  { key: "packet", label: "Packet" },
] as const;

export function StepIndicator({ sessionId }: { sessionId: string }) {
  const { pathname } = useLocation();
  const currentIdx = STEPS.findIndex((s) => pathname.endsWith(`/${s.key}`));

  return (
    <nav aria-label="Progress" className="border-b border-border bg-card/50">
      <ol className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-6 py-4 text-sm">
        {STEPS.map((step, i) => {
          const isDone = currentIdx > i;
          const isCurrent = currentIdx === i;
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-2">
              <Link
                to={`/session/$sessionId/${step.key}` as string}
                params={{ sessionId }}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
                  isCurrent
                    ? "bg-foreground text-background"
                    : isDone
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:bg-accent"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                    isCurrent
                      ? "border-background bg-background text-foreground"
                      : isDone
                        ? "border-foreground bg-foreground text-background"
                        : "border-border"
                  }`}
                  aria-hidden
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="font-medium">{step.label}</span>
              </Link>
              {i < STEPS.length - 1 ? (
                <span className="text-muted-foreground/50" aria-hidden>
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
