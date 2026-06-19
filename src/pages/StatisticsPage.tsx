import { useEffect, useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import Card from "../components/Card";
import { MathUtil } from "../lib/util";
import { getApproximatedProfile } from "../lib/metabolism";
import { optimizeVariants } from "../lib/variantOptimizer";
import RemoteTreatments, {
  glucoseEventType,
  insulinEventType,
} from "../lib/remote/treatments";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { WizardStore } from "../storage/wizardStore";
import { InsulinVariant } from "../models/types/insulinVariant";
import { RescueVariant } from "../models/types/rescueVariant";
import {
  EmptyState,
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";
import WizardManager from "../managers/wizardManager";

const calPerCarb = 4; // kcal per gram of carbs (matching Meal model)

interface DataStatisticsProps {
  title: string;
  data: number[];
}

function DataStatistics({ title, data }: DataStatisticsProps) {
  if (data.length === 0) {
    return (
      <Card>
        <div className="fw-semibold mb-2">{title}</div>
        <EmptyState>Not enough data yet.</EmptyState>
      </Card>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const mean = MathUtil.mean(data);
  const median = MathUtil.median(data);
  const stdev = MathUtil.stdev(data);
  const stdmin = mean - stdev;
  const stdmax = mean + stdev;

  return (
    <Card>
      <div className="fw-semibold mb-3">{title}</div>
      <MetricGrid>
        <MetricPill label="Average" value={mean.toFixed(2)} />
        <MetricPill label="Median" value={median.toFixed(2)} />
        <MetricPill label="Std dev" value={stdev.toFixed(2)} />
        <MetricPill
          label="Std range"
          value={`${stdmin.toFixed(2)} - ${stdmax.toFixed(2)}`}
        />
        <MetricPill label="Range" value={`${min.toFixed(2)} - ${max.toFixed(2)}`} />
      </MetricGrid>
    </Card>
  );
}

interface DaySummary {
  date: string;
  sessions: number;
  carbs: number;
  protein: number;
  fat: number;
  mealCalories: number;   // from meals only
  rescueCalories: number; // from rescue carbs (×4)
  totalCalories: number;  // mealCalories + rescueCalories
  bolus: number;          // from sessions
  extraBolus: number;     // out-of-session boluses
  totalBolus: number;     // bolus + extraBolus
  basal: number;
  glucose: number;        // from sessions
  extraGlucose: number;   // out-of-session rescues
  totalGlucose: number;   // glucose + extraGlucose
  avgScore: number;
}

type DayEntry = {
  sessions: number;
  carbs: number;
  protein: number;
  fat: number;
  mealCalories: number;
  bolus: number;
  dailyBasal: number | null;
  glucose: number;
  scores: number[];
};

/* Group sessions into 6AM-aligned days */
function groupSessionsByDay(
  sessions: import("../models/session").default[],
): DaySummary[] {
  const dayMap = new Map<string, DayEntry>();

  for (const s of sessions) {
    const shifted = new Date(s.timestamp.getTime() - 6 * 60 * 60 * 1000);
    const dateKey = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;

    const entry = dayMap.get(dateKey) || {
      sessions: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      mealCalories: 0,
      bolus: 0,
      dailyBasal: null,
      glucose: 0,
      scores: [],
    } as DayEntry;

    entry.sessions += 1;
    entry.carbs += s.carbs;
    entry.protein += s.protein;
    entry.fat += s.fat;
    entry.mealCalories += s.calories;
    entry.bolus += s.insulin;
    if (s.dailyBasal !== null && entry.dailyBasal === null) {
      entry.dailyBasal = s.dailyBasal;
    }
    entry.glucose += s.glucose;
    const sc = s.score;
    if (Number.isFinite(sc)) entry.scores.push(sc);

    dayMap.set(dateKey, entry);
  }

  return Array.from(dayMap.entries())
    .map(([date, e]) => {
      const rescueCal = e.glucose * calPerCarb;
      return {
        date,
        sessions: e.sessions,
        carbs: e.carbs,
        protein: e.protein,
        fat: e.fat,
        mealCalories: e.mealCalories,
        rescueCalories: rescueCal,
        totalCalories: e.mealCalories + rescueCal,
        bolus: e.bolus,
        extraBolus: 0,
        totalBolus: e.bolus,
        basal: e.dailyBasal ?? 0,
        glucose: e.glucose,
        extraGlucose: 0,
        totalGlucose: e.glucose,
        avgScore:
          e.scores.length > 0
            ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length
            : 0,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Shift a Date by -6h and return the 6AM-aligned date key */
function get6amDateKey(d: Date): string {
  const shifted = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

/** Build a set of session event timestamps (ms, rounded to nearest minute) */
function buildTimestampSet(items: { timestamp: Date }[]): Set<number> {
  const set = new Set<number>();
  for (const item of items) {
    set.add(Math.round(item.timestamp.getTime() / 60000) * 60000);
  }
  return set;
}

function DailyMacros({
  days,
  extraBolusByDay,
  extraGlucoseByDay,
}: {
  days: DaySummary[];
  extraBolusByDay: Map<string, number>;
  extraGlucoseByDay: Map<string, number>;
}) {
  if (days.length === 0) {
    return (
      <Card>
        <div className="fw-semibold mb-2">Daily macros</div>
        <EmptyState>Not enough data yet.</EmptyState>
      </Card>
    );
  }

  // Merge extras into each day
  for (const d of days) {
    const eb = extraBolusByDay.get(d.date) ?? 0;
    d.extraBolus = eb;
    d.totalBolus = d.bolus + eb;

    const eg = extraGlucoseByDay.get(d.date) ?? 0;
    d.extraGlucose = eg;
    d.totalGlucose = d.glucose + eg;

    const extraRescueCal = eg * calPerCarb;
    d.rescueCalories = d.glucose * calPerCarb + extraRescueCal;
    d.totalCalories = d.mealCalories + d.rescueCalories;
  }

  function avgForWindow(windowDays: number | null) {
    const slice = windowDays ? days.slice(0, windowDays) : days;
    const n = slice.length;
    if (n === 0) return { avgCalories: 0, avgCarbs: 0, avgProtein: 0, avgFat: 0, avgBolus: 0, avgBasal: 0, avgRescue: 0, avgScore: 0, label: `${windowDays ?? "All"}d`, days: n };

    const avgCalories = slice.reduce((s, d) => s + d.totalCalories, 0) / n;
    const avgCarbs = slice.reduce((s, d) => s + d.carbs, 0) / n;
    const avgProtein = slice.reduce((s, d) => s + d.protein, 0) / n;
    const avgFat = slice.reduce((s, d) => s + d.fat, 0) / n;
    const avgBolus = slice.reduce((s, d) => s + d.totalBolus, 0) / n;
    const basalSlice = slice.filter((d) => d.basal > 0);
    const avgBasal = basalSlice.length > 0
      ? basalSlice.reduce((s, d) => s + d.basal, 0) / basalSlice.length
      : 0;
    const avgRescue = slice.reduce((s, d) => s + d.totalGlucose, 0) / n;
    const avgScore = slice.reduce((s, d) => s + d.avgScore, 0) / n;
    return { avgCalories, avgCarbs, avgProtein, avgFat, avgBolus, avgBasal, avgRescue, avgScore, label: `${windowDays ?? "All"}d`, days: n };
  }

  const windows = [avgForWindow(7), avgForWindow(15), avgForWindow(30), avgForWindow(null)];
  const allTime = windows[3];

  return (
    <>
      <Card>
        <div className="fw-semibold mb-3">Daily averages</div>
        <div className="d-flex flex-wrap gap-3 justify-content-between">
          {windows.map((w) => (
            <div key={w.label} className="flex-fill" style={{ minWidth: "10rem" }}>
              <div className="small text-uppercase text-muted fw-semibold mb-2">{w.label} ({w.days} days)</div>
              <MetricGrid>
                <MetricPill label="Calories" value={`${w.avgCalories.toFixed(0)} kcal`} />
                <MetricPill label="Carbs" value={`${w.avgCarbs.toFixed(1)} g`} />
                <MetricPill label="Protein" value={`${w.avgProtein.toFixed(1)} g`} />
                <MetricPill label="Fat" value={`${w.avgFat.toFixed(1)} g`} />
                <MetricPill label="Bolus" value={`${w.avgBolus.toFixed(2)} u`} />
                <MetricPill label="Basal" value={`${w.avgBasal.toFixed(2)} u`} />
                <MetricPill label="Rescue" value={`${w.avgRescue.toFixed(1)} g`} />
                <MetricPill label="Score" value={w.avgScore.toFixed(2)} />
              </MetricGrid>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="fw-semibold mb-3">Daily breakdown</div>
        <div className="table-responsive">
          <table className="table table-sm table-borderless mb-0">
            <thead>
              <tr className="small text-muted text-uppercase">
                <th className="fw-semibold">Date</th>
                <th className="fw-semibold text-end">Sessions</th>
                <th className="fw-semibold text-end">Kcal</th>
                <th className="fw-semibold text-end">Carbs</th>
                <th className="fw-semibold text-end">Protein</th>
                <th className="fw-semibold text-end">Fat</th>
                <th className="fw-semibold text-end">Bolus</th>
                <th className="fw-semibold text-end">Basal</th>
                <th className="fw-semibold text-end">Rescue</th>
                <th className="fw-semibold text-end">Score</th>
              </tr>
            </thead>
            <tbody>
              {days.slice(0, 30).map((d) => (
                <tr key={d.date}>
                  <td className="fw-semibold text-nowrap">{d.date}</td>
                  <td className="text-end">{d.sessions}</td>
                  <td className="text-end">{d.totalCalories.toFixed(0)}</td>
                  <td className="text-end">{d.carbs.toFixed(1)}</td>
                  <td className="text-end">{d.protein.toFixed(1)}</td>
                  <td className="text-end">{d.fat.toFixed(1)}</td>
                  <td className="text-end">{d.totalBolus.toFixed(2)}</td>
                  <td className="text-end">{d.basal.toFixed(2)}</td>
                  <td className="text-end">{d.totalGlucose.toFixed(0)}g</td>
                  <td className="text-end">{d.avgScore.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-active fw-semibold">
                <td className="text-nowrap">Avg</td>
                <td className="text-end">{(days.reduce((s, d) => s + d.sessions, 0) / days.length).toFixed(1)}</td>
                <td className="text-end">{allTime.avgCalories.toFixed(0)}</td>
                <td className="text-end">{allTime.avgCarbs.toFixed(1)}</td>
                <td className="text-end">{allTime.avgProtein.toFixed(1)}</td>
                <td className="text-end">{allTime.avgFat.toFixed(1)}</td>
                <td className="text-end">{allTime.avgBolus.toFixed(2)}</td>
                <td className="text-end">{allTime.avgBasal.toFixed(2)}</td>
                <td className="text-end">{allTime.avgRescue.toFixed(1)}g</td>
                <td className="text-end">{allTime.avgScore.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

export default function StatisticsPage() {
  const [templates] = WizardStore.templates.useState();

  const allSessions = useMemo(
    () => WizardManager.getAllSessions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates],
  );

  const carbs = useMemo(() => allSessions.map((s) => s.carbs), [allSessions]);
  const protein = useMemo(
    () => allSessions.map((s) => s.protein),
    [allSessions],
  );
  const fat = useMemo(() => allSessions.map((s) => s.fat), [allSessions]);
  const calories = useMemo(
    () => allSessions.map((s) => s.calories),
    [allSessions],
  );
  const insulin = useMemo(
    () => allSessions.map((s) => s.insulin),
    [allSessions],
  );
  const glucose = useMemo(
    () => allSessions.map((s) => s.glucose),
    [allSessions],
  );

  const dailySummaries = useMemo(
    () => groupSessionsByDay(allSessions),
    [allSessions],
  );

  // --- Out-of-session tracking ---
  const sessionInsulinTimestamps = useMemo(
    () => buildTimestampSet(allSessions.flatMap((s) => s.insulins)),
    [allSessions],
  );
  const sessionGlucoseTimestamps = useMemo(
    () => buildTimestampSet(allSessions.flatMap((s) => s.glucoses)),
    [allSessions],
  );

  const [extraBolusByDay, setExtraBolusByDay] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [extraGlucoseByDay, setExtraGlucoseByDay] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);

  useEffect(() => {
    if (dailySummaries.length === 0) return;

    const dates = dailySummaries.map((d) => d.date);
    const earliest = new Date(dates[dates.length - 1] + "T06:00:00");
    const latest = new Date(dates[0] + "T06:00:00");
    const fetchFrom = new Date(earliest.getTime() - 24 * 60 * 60 * 1000);
    const fetchTo = new Date(latest.getTime() + 24 * 60 * 60 * 1000);

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError(false);

    Promise.all([
      RemoteTreatments.getTreatmentByType(insulinEventType, fetchFrom, fetchTo),
      RemoteTreatments.getTreatmentByType(glucoseEventType, fetchFrom, fetchTo),
    ])
      .then(([insulinTreatments, glucoseTreatments]) => {
        if (cancelled) return;

        // --- Extra boluses ---
        const bolusMap = new Map<string, number>();
        for (const t of (insulinTreatments as any[])) {
          const dose = t.insulin;
          if (!dose || dose <= 0) continue;
          const tMs = Math.round(new Date(t.created_at).getTime() / 60000) * 60000;
          if (sessionInsulinTimestamps.has(tMs)) continue;
          let matched = false;
          for (const ts of sessionInsulinTimestamps) {
            if (Math.abs(tMs - ts) <= 120000) { matched = true; break; }
          }
          if (matched) continue;
          const dayKey = get6amDateKey(new Date(t.created_at));
          bolusMap.set(dayKey, (bolusMap.get(dayKey) ?? 0) + dose);
        }
        if (!cancelled) setExtraBolusByDay(bolusMap);

        // --- Extra rescues ---
        const glucoseMap = new Map<string, number>();
        for (const t of (glucoseTreatments as any[])) {
          const grams = t.carbs;
          if (!grams || grams <= 0) continue;
          const tMs = Math.round(new Date(t.created_at).getTime() / 60000) * 60000;
          if (sessionGlucoseTimestamps.has(tMs)) continue;
          let matched = false;
          for (const ts of sessionGlucoseTimestamps) {
            if (Math.abs(tMs - ts) <= 120000) { matched = true; break; }
          }
          if (matched) continue;
          const dayKey = get6amDateKey(new Date(t.created_at));
          glucoseMap.set(dayKey, (glucoseMap.get(dayKey) ?? 0) + grams);
        }
        if (!cancelled) setExtraGlucoseByDay(glucoseMap);
      })
      .catch(() => {
        if (!cancelled) setRemoteError(true);
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dailySummaries, sessionInsulinTimestamps, sessionGlucoseTimestamps]);

  // --- End out-of-session tracking ---

  const [approximatedProfile] = useState(getApproximatedProfile());
  const [originalInsulinVariants] = InsulinVariantStore.variants.useState();
  const [originalRescueVariants] = RescueVariantStore.variants.useState();

  const [insulinVariants, setInsulinVariants] = useState<InsulinVariant[]>(
    originalInsulinVariants,
  );
  const [rescueVariants, setRescueVariants] = useState<RescueVariant[]>(
    originalRescueVariants,
  );

  function optimizeForVariant(...names: string[]) {
    const optimized = optimizeVariants(
      WizardStore.templates.value,
      originalInsulinVariants,
      originalRescueVariants,
      names,
    );
    setInsulinVariants(optimized.insulinVariants);
    setRescueVariants(optimized.rescueVariants);
  }

  return (
    <PageLayout maxWidth="42rem">
      <PageHeader
        eyebrow="Data"
        title="Statistics"
        subtitle="Review session trends, learned metabolic values, and optimized variant effects in a cleaner mobile layout."
      />

      <Card>
        <MetricGrid>
          <MetricPill label="Sessions" value={allSessions.length} />
          <MetricPill label="Days with data" value={dailySummaries.length} />
        </MetricGrid>
      </Card>

      <DailyMacros
        days={dailySummaries}
        extraBolusByDay={extraBolusByDay}
        extraGlucoseByDay={extraGlucoseByDay}
      />

      {remoteLoading && (
        <Card>
          <div className="small text-muted">Fetching out-of-session data from Nightscout…</div>
        </Card>
      )}
      {remoteError && (
        <Card>
          <div className="small text-warning">
            Couldn't fetch out-of-session data from Nightscout.
          </div>
        </Card>
      )}

      <DataStatistics title="Carbs (g)" data={carbs} />
      <DataStatistics title="Protein (g)" data={protein} />
      <DataStatistics title="Fat (g)" data={fat} />
      <DataStatistics title="Calories (kcal)" data={calories} />
      <DataStatistics title="Bolus (u)" data={insulin} />
      <DataStatistics title="Low correction" data={glucose} />

      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Learned info
        </div>
        <MetricGrid>
          <MetricPill
            label="Carbs effect"
            value={`${approximatedProfile.carbsEffect.toFixed(2)} mg/dL/g`}
          />
          <MetricPill
            label="Protein effect"
            value={`${approximatedProfile.proteinEffect.toFixed(2)} mg/dL/g`}
          />
        </MetricGrid>
      </Card>

      <Card>
        <div className="d-grid mb-3">
          <Button onClick={() => optimizeForVariant()} variant="outline-primary">
            Optimize All Variants
          </Button>
        </div>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Individual optimization
        </div>
        <div className="d-grid gap-2">
          {originalInsulinVariants.map((v) => (
            <div
              key={v.name}
              className="rounded-4 border p-3 d-flex justify-content-between align-items-center gap-3"
            >
              <div>
                <div className="fw-semibold">{v.name}</div>
                <div className="small text-muted">{v.effect} mg/dL per unit</div>
              </div>
              <Button
                onClick={() => optimizeForVariant(v.name)}
                variant="outline-primary"
                size="sm"
              >
                Optimize
              </Button>
            </div>
          ))}
          {originalRescueVariants.map((v) => (
            <div
              key={v.name}
              className="rounded-4 border p-3 d-flex justify-content-between align-items-center gap-3"
            >
              <div>
                <div className="fw-semibold">{v.name}</div>
                <div className="small text-muted">
                  {v.effect} mg/dL/{v.unitLetter}
                </div>
              </div>
              <Button
                onClick={() => optimizeForVariant(v.name)}
                variant="outline-primary"
                size="sm"
              >
                Optimize
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Optimized insulin effects
        </div>
        <div className="d-grid gap-2">
          {insulinVariants.map((v, i) => (
            <div key={v.name} className="rounded-4 border p-3 bg-light-subtle">
              <div className="fw-semibold">{v.name}</div>
              <div className="small text-muted">
                {v.effect} mg/dL per unit from {originalInsulinVariants[i].effect}
              </div>
            </div>
          ))}
          {rescueVariants.map((v, i) => (
            <div key={v.name} className="rounded-4 border p-3 bg-light-subtle">
              <div className="fw-semibold">{v.name}</div>
              <div className="small text-muted">
                {v.effect} mg/dL/{v.unitLetter} from {originalRescueVariants[i].effect}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageLayout>
  );
}
