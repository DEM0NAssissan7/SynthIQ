import { useState } from "react";
import { Button } from "react-bootstrap";
import Card from "../components/Card";
import MdSegmentedButton from "../components/md3/MdSegmentedButton";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";
import {
  analyzeForecastAccuracy,
  type Comparison,
  type ForecastAccuracyReport,
  type OutcomeSummary,
  type Suggestion,
} from "../lib/forecastAccuracy";
import WizardManager from "../managers/wizardManager";

const LABELS: Record<Suggestion, string> = {
  actual: "Your doses",
  forecast: "Forecast",
  hindsight: "Forecast, knowing the meal",
  balancer: "Balancer, knowing the meal",
};

type Segment = "All sessions" | "Matching base" | "Different base";
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "All sessions", label: "All meals" },
  { value: "Matching base", label: "Repeat meals" },
  { value: "Different base", label: "New meals" },
];
const SEGMENT_NOTES: Record<Segment, string> = {
  "All sessions": "Every meal we could replay.",
  "Matching base":
    "You'd eaten the same foods before, with amounts within 5%, so the forecast had a close example to work from.",
  "Different base":
    "No earlier meal matched, so the forecast worked from the most similar one it could find.",
};

const num = (value: number | null, digits = 2) =>
  value === null ? "–" : value.toFixed(digits);
const pct = (value: number) => `${Math.round(value * 100)}%`;
const mgdl = (value: number) => `${Math.round(value)} mg/dL`;
const day = (time: number) => new Date(time).toLocaleDateString();

interface ScoreRow {
  label: string;
  value: (o: OutcomeSummary) => number;
  format: (value: number) => string;
  best?: "lowest" | "highest"; // Rows without this have no better or worse
}

function getScoreRows(report: ForecastAccuracyReport): ScoreRow[] {
  const { targetBG, lowBG, highBG } = report;
  return [
    {
      label: `Average distance from ${targetBG}`,
      value: (o) => o.meanAbsFromTarget,
      format: mgdl,
      best: "lowest",
    },
    {
      label: "Tends to run",
      value: (o) => o.meanFromTarget,
      format: (v) => `${Math.round(Math.abs(v))} ${v > 0 ? "high" : "low"}`,
    },
    {
      label: `Distance from ${targetBG} at the end`,
      value: (o) => o.meanAbsLanding,
      format: mgdl,
      best: "lowest",
    },
    {
      label: `Time in range (${lowBG}–${highBG})`,
      value: (o) => o.timeInRange,
      format: pct,
      best: "highest",
    },
    {
      label: `Time low (under ${lowBG})`,
      value: (o) => o.timeBelowLow,
      format: pct,
      best: "lowest",
    },
    {
      label: `Time high (over ${highBG})`,
      value: (o) => o.timeAboveHigh,
      format: pct,
      best: "lowest",
    },
    {
      label: `Meals that went low (under ${lowBG})`,
      value: (o) => o.wentLow,
      format: pct,
      best: "lowest",
    },
    {
      label: "Meals with a severe low (under 54)",
      value: (o) => o.wentSevereLow,
      format: pct,
      best: "lowest",
    },
    {
      label: `Meals that went high (over ${highBG})`,
      value: (o) => o.wentHigh,
      format: pct,
      best: "lowest",
    },
  ];
}

function ScoreTable({
  rows,
  outcomes,
}: {
  rows: ScoreRow[];
  outcomes: OutcomeSummary[];
}) {
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th />
            {outcomes.map((o) => (
              <th key={o.suggestion} className="text-end">
                {LABELS[o.suggestion]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = outcomes.map(row.value);
            const bestValue =
              row.best === "lowest"
                ? Math.min(...values)
                : row.best === "highest"
                  ? Math.max(...values)
                  : null;
            return (
              <tr key={row.label}>
                <td>{row.label}</td>
                {outcomes.map((o, i) => (
                  <td
                    key={o.suggestion}
                    className={`text-end text-nowrap ${
                      values[i] === bestValue ? "fw-bold text-success" : ""
                    }`.trim()}
                  >
                    {row.format(values[i])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getVerdict(report: ForecastAccuracyReport, segment: Segment) {
  const sessions = report.sessions.filter(
    (s) =>
      Object.values(s.outcomes).every((o) => o !== null) &&
      (segment === "All sessions" ||
        s.matchingBase === (segment === "Matching base")),
  );
  const forecastCloser = sessions.filter(
    (s) =>
      s.outcomes.forecast!.meanAbsFromTarget <
      s.outcomes.actual!.meanAbsFromTarget,
  ).length;
  const yoursCloser = sessions.length - forecastCloser;
  return {
    title:
      forecastCloser > yoursCloser
        ? "The forecast did better than your doses"
        : forecastCloser < yoursCloser
          ? "Your doses did better than the forecast"
          : "The forecast and your doses tied",
    detail: `The forecast stayed closer to ${report.targetBG} in ${forecastCloser} of ${sessions.length} meals.`,
  };
}

function ComparisonTable({ rows }: { rows: Comparison[] }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm small mb-0">
        <thead>
          <tr>
            <th>Which doses</th>
            <th>Doses</th>
            <th>Average lean (u)</th>
            <th>Average gap (u)</th>
            <th>Within 1u</th>
            <th>Over by 0.5u+</th>
            <th>Under by 0.5u+</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.segment}>
              <td className="text-nowrap">{row.segment}</td>
              <td>{row.n}</td>
              <td>{num(row.bias)}</td>
              <td>{num(row.mae)}</td>
              <td>{pct(row.withinOneUnit)}</td>
              <td>{pct(row.overRate)}</td>
              <td>{pct(row.underRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupComparisons(comparisons: Comparison[]) {
  const groups = new Map<string, Comparison[]>();
  comparisons.forEach((c) => {
    const key = `${LABELS[c.predicted]} compared with ${LABELS[c.reference]}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  });
  return [...groups.entries()];
}

export default function ForecastAccuracyPage() {
  const [report, setReport] = useState<ForecastAccuracyReport | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState("");
  const [segment, setSegment] = useState<Segment>("All sessions");
  const [showBestCase, setShowBestCase] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  function run() {
    setRunning(true);
    // Let the button repaint before the blocking work starts
    setTimeout(() => {
      try {
        setReport(analyzeForecastAccuracy(WizardManager.getAllSessions()));
      } finally {
        setRunning(false);
      }
    }, 50);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report));
      setCopied("Copied");
    } catch {
      setCopied("Could not copy");
    }
  }

  const outcomes = (report?.outcomes ?? []).filter(
    (o) => o.segment === segment,
  );
  const mainOutcomes = outcomes.filter(
    (o) => o.suggestion === "actual" || o.suggestion === "forecast",
  );
  const doses = report
    ? [...report.doses].sort(
        (a, b) => b.sessionTime - a.sessionTime || a.doseIndex - b.doseIndex,
      )
    : [];
  const verdict = report && outcomes.length > 0 && getVerdict(report, segment);

  return (
    <PageLayout maxWidth="44rem">
      <PageHeader
        eyebrow="Utility"
        title="Forecast accuracy"
        subtitle="What would've happened to your blood sugar if you'd followed the dose forecast on past meals."
      />
      <Card>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Button onClick={run} disabled={running}>
            {running ? "Replaying your meals…" : "Run analysis"}
          </Button>
          {report && (
            <Button variant="secondary" onClick={copyReport}>
              Copy results
            </Button>
          )}
          {copied && <span className="small text-muted">{copied}</span>}
        </div>
        {!report && (
          <p className="small text-muted mt-3 mb-0">
            This only reads your past meals. It doesn&apos;t change anything.
          </p>
        )}
      </Card>

      {report && report.doses.length === 0 && (
        <Card>
          <EmptyState>No meals could be replayed yet.</EmptyState>
        </Card>
      )}

      {report && outcomes.length > 0 && verdict && (
        <>
          <MdSegmentedButton
            className="mb-3"
            value={segment}
            onChange={setSegment}
            options={SEGMENTS}
          />

          <Card>
            <h2 className="h5 mb-1">{verdict.title}</h2>
            <p className="mb-2">{verdict.detail}</p>
            <p className="small text-muted mb-0">
              {SEGMENT_NOTES[segment]} {outcomes[0].n} meals.
            </p>
          </Card>

          <Card>
            <div className="app-card-title">Side by side</div>
            <ScoreTable rows={getScoreRows(report)} outcomes={mainOutcomes} />
            <p className="small text-muted mt-3 mb-0">
              Green is the better result. Both columns are simulated: your
              insulin and rescues are removed from each meal to see what the
              food did alone, then each set of doses is added back. Rescues
              stay out, so lows look worse than what you really lived through.
            </p>
          </Card>

          <Card>
            <div className="app-card-title">Best possible</div>
            <p className="small text-muted">
              These two already know how each meal went, which you can&apos;t
              know while dosing. They show what was achievable, not a fair
              competitor.
            </p>
            <Button
              variant="secondary"
              onClick={() => setShowBestCase(!showBestCase)}
            >
              {showBestCase ? "Hide" : "Show"} best possible
            </Button>
            {showBestCase && (
              <div className="mt-3">
                <ScoreTable rows={getScoreRows(report)} outcomes={outcomes} />
              </div>
            )}
          </Card>

          <Card>
            <div className="app-card-title">About this run</div>
            <ul className="small mb-0 ps-3">
              <li>
                Replayed {report.analyzedSessions} of {report.totalSessions}{" "}
                meals, covering {report.doses.length} doses.
              </li>
              <li>
                Target {report.targetBG}, low {report.lowBG}, high{" "}
                {report.highBG}, from your settings.
              </li>
              <li>
                {pct(report.baseQuality.matchingShare)} of doses had a repeat
                meal to work from, averaging{" "}
                {num(report.baseQuality.meanBaseCount, 1)} past meals per dose.
              </li>
              {Object.entries(report.skipped).map(([reason, count]) => (
                <li key={reason}>
                  Skipped {count}: {reason.toLowerCase()}.
                </li>
              ))}
            </ul>
          </Card>

          <div className="mb-3">
            <Button
              variant="secondary"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide" : "Show"} detailed numbers
            </Button>
          </div>

          {showDetails &&
            groupComparisons(report.comparisons).map(([title, rows]) => (
              <Card key={title}>
                <div className="app-card-title">{title}</div>
                <ComparisonTable rows={rows} />
              </Card>
            ))}

          {showDetails && (
            <Card>
              <div className="app-card-title">Every dose</div>
              <div className="table-responsive">
                <table className="table table-sm small mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Meal</th>
                      <th>Dose</th>
                      <th>Hours in</th>
                      <th>Simulated BG</th>
                      <th>You took</th>
                      <th>Forecast</th>
                      <th>Forecast, knowing the meal</th>
                      <th>Balancer, knowing the meal</th>
                      <th>Learned from</th>
                      <th>Carbs vs that meal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doses.map((d) => (
                      <tr key={`${d.sessionUUID}-${d.doseIndex}`}>
                        <td className="text-nowrap">{day(d.sessionTime)}</td>
                        <td className="text-nowrap">{d.foods}</td>
                        <td>
                          {d.doseIndex + 1}/{d.doseCount}
                        </td>
                        <td>{num(d.hoursIn, 1)}</td>
                        <td>{Math.round(d.BG)}</td>
                        <td>{num(d.actual, 1)}</td>
                        <td>{num(d.forecast, 1)}</td>
                        <td>{num(d.hindsight, 1)}</td>
                        <td>{num(d.balancer, 1)}</td>
                        <td className="text-nowrap">{day(d.baseTime)}</td>
                        <td>{num(d.carbsDiff, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </PageLayout>
  );
}
