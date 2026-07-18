import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createPacket, deleteSession } from "@/lib/api/client";
import { clearSession, readSession } from "@/lib/session-storage";
import { Disclaimer } from "@/components/disclaimer";
import { DECISION_BOUNDARY, READINESS_LABEL, comparisonLabel } from "@/lib/language";

export const Route = createFileRoute("/session/$sessionId/packet")({
  head: () => ({ meta: [{ title: "Your packet — RealDoor" }] }),
  component: PacketPage,
});

function PacketPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const token = readSession()?.session_token ?? "";
  const [notes, setNotes] = useState("");

  const packet = useMutation({
    mutationFn: () => createPacket(sessionId, token),
  });

  useEffect(() => {
    packet.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const del = useMutation({
    mutationFn: () => deleteSession(sessionId, token),
    onSuccess: () => {
      clearSession();
      navigate({ to: "/" });
    },
  });

  const download = () => {
    if (!packet.data) return;
    const payload = { ...packet.data, json: { ...packet.data.json, renter_notes: notes } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realdoor-packet-${packet.data.packet_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const p = packet.data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl text-foreground">Your packet</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        This is what a reviewer will see. You control it — download it, add
        notes, or delete everything from this browser.
      </p>

      {!p ? (
        <div className="mt-8 h-64 animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : (
        <div className="mt-8 space-y-6">
          <Section title="Identity">
            <KeyValues data={p.json.identity} />
          </Section>
          <Section title="Household">
            <KeyValues data={p.json.household} />
          </Section>
          <Section title="Income">
            <ul className="space-y-1 text-sm">
              {p.json.income.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {s.label} ({s.period})
                  </span>
                  <span className="text-foreground">${s.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Calculation">
            <dl className="space-y-1 text-sm">
              <Row label="Formula" value={p.json.calculation.formula} />
              <Row
                label="Annualized income"
                value={`$${p.json.calculation.annualized_income.toLocaleString()}`}
              />
              <Row
                label="Threshold"
                value={`$${p.json.calculation.threshold.toLocaleString()}`}
              />
              <Row label="Comparison" value={comparisonLabel(p.json.calculation.comparison)} />
              <Row label="Effective date" value={p.json.calculation.effective_date} />
            </dl>
          </Section>
          <Section title="Readiness">
            <p className="text-sm">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {p.json.readiness.status}
              </span>{" "}
              — {READINESS_LABEL[p.json.readiness.status]}
            </p>
            {p.json.readiness.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {p.json.readiness.reasons.map((r) => (
                  <li key={r.code}>• {r.message}</li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section title="Citations">
            <ul className="space-y-2 text-sm">
              {p.json.citations.map((c) => (
                <li key={c.rule_id}>
                  <p className="text-foreground">{c.authority}</p>
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {c.source_locator}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Your notes (optional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you'd like the reviewer to know."
              rows={4}
            />
          </Section>

          <Disclaimer>{DECISION_BOUNDARY.general}</Disclaimer>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Trash2 className="h-4 w-4" /> Delete session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes your profile, documents, and packet from the
                    server and from this browser. It can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep session</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate()}>
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={download} className="gap-2">
              <Download className="h-4 w-4" /> Download packet
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function KeyValues({ data }: { data: Record<string, string | number | null> }) {
  const entries = Object.entries(data);
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">No values yet.</p>;
  return (
    <dl className="space-y-1 text-sm">
      {entries.map(([k, v]) => (
        <Row key={k} label={k} value={v == null || v === "" ? "—" : String(v)} />
      ))}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
