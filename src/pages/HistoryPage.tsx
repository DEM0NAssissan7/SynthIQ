import { Button, ToggleButton } from "react-bootstrap";
import Card from "../components/Card";
import { getFullPrettyDate } from "../lib/timing";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { WizardStore } from "../storage/wizardStore";
import { useState } from "react";
import { BasalStore } from "../storage/basalStore";
import {
  EmptyState,
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

function getCSV(templates: MealTemplate[], liverOutput: number): string {
  let out =
    "Template Name,Date,Carbs,Protein,Total Insulin Taken,# Insulin Doses,Rescue Doses Taken,InitialBG,FinalBG,Control Score (lower is better),Theoretical Meal Rise (mg/dL),Fasting Velocity (mg/dL per hour),Basal Units per Day (u/day),Sensitivity Index,Invalid\n";
  for (const t of templates) {
    for (const s of t.sessions) {
      out += `${t.name},${getFullPrettyDate(s.timestamp)},${s.carbs},${s.protein},${s.length},${s.insulin},${s.insulins.length},${s.glucose},${s.initialGlucose},${s.finalBG},${s.score},${s.theoreticalMealRise},${s.fastingVelocity},${s.dailyBasal},${s.getSensitivityIndex(liverOutput)},${s.isInvalid}\n`;
    }
  }
  return out;
}

function SessionCard({
  session,
  liverOutput,
}: {
  session: Session;
  liverOutput: number;
}) {
  const [, setRerenderFlag] = useState(false);

  const backgroundClass = session.isInvalid
    ? session.isGarbage
      ? "bg-danger-subtle"
      : "bg-warning-subtle"
    : "";

  return (
    <Card className={backgroundClass}>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="fw-semibold">{getFullPrettyDate(session.timestamp)}</div>
          <div className="small text-muted">UUID: {session.uuid}</div>
        </div>
        <ToggleButton
          id={`toggle-check-${session.uuid}`}
          type="checkbox"
          variant="outline-danger"
          checked={session.isGarbage}
          value="1"
          size="sm"
          onChange={(e) => {
            session.isGarbage = e.currentTarget.checked;
            WizardStore.templates.write();
            setRerenderFlag((f) => !f);
          }}
        >
          Garbage
        </ToggleButton>
      </div>

      <MetricGrid>
        <MetricPill label="Length" value={`${session.length.toFixed(1)} hr`} />
        <MetricPill label="Score" value={session.score.toFixed(0)} />
        <MetricPill label="Carbs" value={`${session.carbs.toFixed()}g`} />
        <MetricPill label="Protein" value={`${session.protein.toFixed()}g`} />
        <MetricPill
          label="Insulin"
          value={`${session.insulin}u${session.correctionInsulin > 0 ? ` [${session.correctionInsulin.toFixed(1)}]` : ""}`}
        />
        <MetricPill label="Glucose" value={`${session.glucose}`} />
        <MetricPill
          label="Blood sugar"
          value={`${session.initialGlucose} -> ${session.finalBG}`}
        />
        <MetricPill
          label="Delta"
          value={`${session.deltaGlucose > 0 ? "+" : ""}${session.deltaGlucose}`}
        />
        <MetricPill
          label="Meal rise"
          value={`${session.theoreticalMealRise.toFixed(0)} mg/dL`}
        />
        <MetricPill
          label="Sensitivity"
          value={session.getSensitivityIndex(liverOutput)?.toFixed(1) ?? "n/a"}
        />
      </MetricGrid>
    </Card>
  );
}

export default function HistoryPage() {
  const liverOutput = BasalStore.estimatedLiverOutput.value ?? 0;
  const templates = WizardStore.templates.value;

  return (
    <PageLayout maxWidth="42rem">
      <PageHeader
        eyebrow="Data"
        title="History"
        subtitle="Review past sessions in a mobile-friendly format or export everything as CSV."
        actions={
          <div className="d-grid">
            <Button
              variant="outline-primary"
              onClick={() => {
                const csv = getCSV(templates, liverOutput);
                const blob = new Blob([csv], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "history.csv";
                a.click();
                window.URL.revokeObjectURL(url);
              }}
            >
              Export to CSV
            </Button>
          </div>
        }
      />

      {templates.length === 0 && (
        <EmptyState>No saved meal templates or sessions yet.</EmptyState>
      )}

      {templates.map((template: MealTemplate, i) => {
        const sessions = [...template.sessions]
          .reverse()
          .filter((session) => session.meals.length >= 1);

        return (
          <Card key={i}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">{template.name}</h2>
                <div className="small text-muted">
                  {sessions.length} stored session{sessions.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {sessions.length === 0 ? (
              <EmptyState>No completed sessions stored for this template.</EmptyState>
            ) : (
              <div className="d-grid gap-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.uuid}
                    session={session}
                    liverOutput={liverOutput}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </PageLayout>
  );
}
