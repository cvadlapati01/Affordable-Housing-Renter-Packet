import {
  createFileRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StepIndicator } from "@/components/step-indicator";
import { readSession, type StoredSession } from "@/lib/session-storage";

export const Route = createFileRoute("/session/$sessionId")({
  component: SessionLayout,
});

function SessionLayout() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s || s.session_id !== sessionId) {
      navigate({ to: "/" });
      return;
    }
    setSession(s);
    setReady(true);
    // Redirect bare /session/:id to /documents
    if (pathname === `/session/${sessionId}` || pathname === `/session/${sessionId}/`) {
      navigate({
        to: "/session/$sessionId/documents",
        params: { sessionId },
        replace: true,
      });
    }
  }, [sessionId, navigate, pathname]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              RealDoor
            </p>
            <h2 className="font-display text-lg text-foreground">
              Session {session.demo_household_id}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Session stored in this browser only
          </span>
        </div>
      </header>
      <StepIndicator sessionId={sessionId} />
      <Outlet />
    </div>
  );
}
