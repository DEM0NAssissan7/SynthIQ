import { useEffect, useMemo, useState } from "react";
import useImportedSessionsState from "../state/useImportedSessionsState";
import Card from "../components/Card";
import { MathUtil } from "../lib/util";
import { getApproximatedProfile } from "../lib/metabolism";
import { optimizeVariants } from "../lib/variantOptimizer";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { WizardStore } from "../storage/wizardStore";
import { InsulinVariant } from "../models/types/insulinVariant";
import { RescueVariant } from "../models/types/rescueVariant";
import { Button } from "react-bootstrap";
import {
  EmptyState,
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

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

export default function StatisticsPage() {
  const { importedSessions } = useImportedSessionsState(true);

  const carbs = useMemo(() => importedSessions.map((s) => s.carbs), [importedSessions]);
  const protein = useMemo(
    () => importedSessions.map((s) => s.protein),
    [importedSessions],
  );
  const fat = useMemo(() => importedSessions.map((s) => s.fat), [importedSessions]);
  const calories = useMemo(
    () => importedSessions.map((s) => s.calories),
    [importedSessions],
  );
  const insulin = useMemo(
    () => importedSessions.map((s) => s.insulin),
    [importedSessions],
  );
  const glucose = useMemo(
    () => importedSessions.map((s) => s.glucose),
    [importedSessions],
  );

  const [readings, setReadings] = useState([] as number[][]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      importedSessions.map((session) =>
        session.getObservedReadings().then((a) => a.map((b: any) => b.sgv)),
      ),
    ).then((loadedReadings) => {
      if (!cancelled) setReadings(loadedReadings);
    });
    return () => {
      cancelled = true;
    };
  }, [importedSessions]);

  const allReadings = useMemo(
    () => readings.flatMap((sessionReadings: number[]) => sessionReadings),
    [readings],
  );

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
          <MetricPill label="Imported sessions" value={importedSessions.length} />
          <MetricPill label="Captured readings" value={allReadings.length} />
        </MetricGrid>
      </Card>

      <DataStatistics title="Carbs (g)" data={carbs} />
      <DataStatistics title="Protein (g)" data={protein} />
      <DataStatistics title="Fat (g)" data={fat} />
      <DataStatistics title="Calories (kcal)" data={calories} />
      <DataStatistics title="Insulin (u)" data={insulin} />
      <DataStatistics title="Low correction" data={glucose} />
      <DataStatistics title="Blood sugar (mg/dL)" data={allReadings} />

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
