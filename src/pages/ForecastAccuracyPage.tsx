import { useState } from "react";
import { Button } from "react-bootstrap";
import Card from "../components/Card";
import {
  EmptyState,
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";
import {
  analyzeForecastAccuracy,
  type Comparison,
  type ForecastAccuracyReport,
  type Suggestion,
} from "../lib/forecastAccuracy";
import WizardManager from "../managers/wizardManager";

const LABELS: Record<Suggestion, string> = {
  forecast: "Forecast",
  hindsight: "Hindsight forecast",
  balancer: "Balancer",
  actual: "Actually taken",
};

const num = (value: number | null, digits = 2) =>
  value === null ? "–" : value.toFixed(digits);
const pct = (value: number) => `${Math.round(value * 100)}%`;
const day = (time: number) => new Date(time).toLocaleDateString();

function ComparisonTable({ rows }: { rows: Comparison[] }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm small mb-0">
        <thead>
          <tr>
            <th>Segment</th>
            <th>n</th>
            <th title="Mean signed error (u)">Bias</th>
            <th title="Mean absolute error (u)">MAE</th>
            <th>RMSE</th>
            <th title="Median absolute error (u)">Med</th>
            <th title="90th percentile absolute error (u)">P90</th>
            <th>≤0.5u</th>
            <th>≤1u</th>
            <th>≤20%</th>
            <th title="Pearson correlation">r</th>
            <th title="More than 0.5u above the reference">Over</th>
            <th title="More than 0.5u below the reference">Under</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.segment}>
              <td className="text-nowrap">{row.segment}</td>
              <td>{row.n}</td>
              <td>{num(row.bias)}</td>
              <td>{num(row.mae)}</td>
              <td>{num(row.rmse)}</td>
              <td>{num(row.medianAbsError)}</td>
              <td>{num(row.p90AbsError)}</td>
              <td>{pct(row.withinHalfUnit)}</td>
              <td>{pct(row.withinOneUnit)}</td>
              <td>{pct(row.within20Percent)}</td>
              <td>{num(row.correlation)}</td>
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
    const key = `${LABELS[c.predicted]} vs ${LABELS[c.reference]}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  });
  return [...groups.entries()];
}

export default function ForecastAccuracyPage() {
  const [report, setReport] = useState<ForecastAccuracyReport | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState("");

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

  const doses = report
    ? [...report.doses].sort(
        (a, b) => b.sessionTime - a.sessionTime || a.doseIndex - b.doseIndex,
      )
    : [];

  return (
    <PageLayout maxWidth="60rem">
      <PageHeader
        eyebrow="Utility"
        title="Forecast accuracy"
        subtitle="Replays past sessions dose by dose, using only what was known at the time. This is read-only."
      />
      <Card>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Button onClick={run} disabled={running}>
            {running ? "Analyzing…" : "Run analysis"}
          </Button>
          {report && (
            <Button variant="secondary" onClick={copyReport}>
              Copy JSON
            </Button>
          )}
          {copied && <span className="small text-muted">{copied}</span>}
        </div>
      </Card>

      {report && report.doses.length === 0 && (
        <Card>
          <EmptyState>No sessions could be analyzed.</EmptyState>
        </Card>
      )}

      {report && (
        <Card>
          <div className="app-card-title">Overview</div>
          <MetricGrid>
            <MetricPill
              label="Sessions analyzed"
              value={`${report.analyzedSessions} / ${report.totalSessions}`}
            />
            <MetricPill label="Doses" value={report.doses.length} />
            <MetricPill
              label="Target / low"
              value={`${report.targetBG} / ${report.lowBG}`}
            />
            <MetricPill
              label="Mean base age"
              value={`${num(report.baseQuality.meanBaseAgeDays, 1)}d`}
            />
            <MetricPill
              label="Mean |Δ carbs|"
              value={`${num(report.baseQuality.meanAbsCarbsDiff, 1)}g`}
            />
            <MetricPill
              label="Mean |Δ protein|"
              value={`${num(report.baseQuality.meanAbsProteinDiff, 1)}g`}
            />
            <MetricPill
              label="Error vs Δ carbs (r)"
              value={num(report.baseQuality.errorVsCarbsCorrelation)}
            />
          </MetricGrid>
          {Object.keys(report.skipped).length > 0 && (
            <div className="small text-muted mt-2">
              Skipped:{" "}
              {Object.entries(report.skipped)
                .map(([reason, count]) => `${reason} (${count})`)
                .join(", ")}
            </div>
          )}
        </Card>
      )}

      {report && report.outcomes.length > 0 && (
        <Card>
          <div className="app-card-title">Simulated outcomes</div>
          <p className="small text-muted">
            The real blood sugar trace, as if only that one dose had been the
            suggested amount. Rescues and other doses stay as they really were.
          </p>
          <div className="table-responsive">
            <table className="table table-sm small mb-0">
              <thead>
                <tr>
                  <th>Dose used</th>
                  <th>n</th>
                  <th>Mean landing error</th>
                  <th>Median landing error</th>
                  <th>Landed ±30</th>
                  <th>Mean lowest BG</th>
                  <th>Went low</th>
                  <th>Time below low</th>
                </tr>
              </thead>
              <tbody>
                {report.outcomes.map((o) => (
                  <tr key={o.suggestion}>
                    <td className="text-nowrap">{LABELS[o.suggestion]}</td>
                    <td>{o.n}</td>
                    <td>{num(o.meanLandingError, 1)}</td>
                    <td>{num(o.medianLandingError, 1)}</td>
                    <td>{pct(o.landedInRange)}</td>
                    <td>{num(o.meanMinBG, 1)}</td>
                    <td>{pct(o.wentLow)}</td>
                    <td>{pct(o.meanTimeBelowLow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {report &&
        groupComparisons(report.comparisons).map(([title, rows]) => (
          <Card key={title}>
            <div className="app-card-title">{title}</div>
            <ComparisonTable rows={rows} />
          </Card>
        ))}

      {doses.length > 0 && (
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
                  <th>BG</th>
                  <th>Taken</th>
                  <th>Forecast</th>
                  <th>Hindsight</th>
                  <th>Balancer</th>
                  <th>Base</th>
                  <th>Δ carbs</th>
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
    </PageLayout>
  );
}
