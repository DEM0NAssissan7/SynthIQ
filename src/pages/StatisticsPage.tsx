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

interface DataStatisticsProps {
  title: string;
  data: number[];
}
function DataStatistics({ title, data }: DataStatisticsProps) {
  const min = useMemo(() => Math.min(...data), [data]);
  const max = useMemo(() => Math.max(...data), [data]);

  const mean = useMemo(() => MathUtil.mean(data), [data]);
  const median = useMemo(() => MathUtil.median(data), [data]);
  const stdev = useMemo(() => MathUtil.stdev(data), [data]);

  const stdmin = useMemo(() => mean - stdev, [mean, stdev]);
  const stdmax = useMemo(() => mean + stdev, [mean, stdev]);
  return (
    <Card>
      <h5>{title}</h5>
      Average: <b>{mean.toFixed(2)}</b> <br />
      StdDev: <b>{stdev.toFixed(2)}</b> ({stdmin.toFixed(2)} -{" "}
      {stdmax.toFixed(2)})<br />
      Median: <b>{median.toFixed(2)}</b> <br />
      Range: {min.toFixed(2)} - {max.toFixed(2)}
    </Card>
  );
}

export default function StatisticsPage() {
  const { importedSessions } = useImportedSessionsState(true);

  const carbs = useMemo(
    () => importedSessions.map((s) => s.carbs),
    [importedSessions],
  );
  const protein = useMemo(
    () => importedSessions.map((s) => s.protein),
    [importedSessions],
  );
  const fat = useMemo(
    () => importedSessions.map((s) => s.fat),
    [importedSessions],
  );
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
    importedSessions.forEach((session) => {
      session.getObservedReadings().then((a) => {
        const observed: number[] = a.map((b: any) => b.sgv);
        readings.push(observed);
        setReadings(readings);
      });
    });
  }, [importedSessions]);

  const allReadings = useMemo(() => {
    let retval: number[] = [];
    readings.forEach((sessionReadings: number[]) =>
      sessionReadings.forEach((r) => retval.push(r)),
    );
    return retval;
  }, [readings]);

  const [approximatedProfile] = useState(getApproximatedProfile());
  const [originalInsulinVariants] = InsulinVariantStore.variants.useState();
  const [originalRescueVariants] = RescueVariantStore.variants.useState();

  const [insulinVariants, setInsulinVariants] = useState<InsulinVariant[]>(
    originalInsulinVariants,
  );
  const [rescueVariants, setRescueVariants] = useState<RescueVariant[]>(
    originalRescueVariants,
  );
  function optimizeForVariant(name: string) {
    const { insulinVariants, rescueVariants } = optimizeVariants(
      WizardStore.templates.value,
      originalInsulinVariants,
      originalRescueVariants,
      [name],
    );
    setInsulinVariants(insulinVariants);
    setRescueVariants(rescueVariants);
  }

  return (
    <>
      <h1>Statistics</h1>
      <p>
        View information on your documented sessions <br />
        <i>{importedSessions.length} sessions imported</i>
      </p>
      <DataStatistics title="Carbs (g)" data={carbs} />
      <DataStatistics title="Protein (g)" data={protein} />
      <DataStatistics title="Fat (g)" data={fat} />
      <DataStatistics title="Calories (kcal)" data={calories} />
      <DataStatistics title="Insulin (u)" data={insulin} />
      <DataStatistics title="Low Correction (doses)" data={glucose} />
      <DataStatistics title="Blood Sugar (mg/dL)" data={allReadings} />
      <h3>Learned Info</h3>
      <p>Information Derived From Data</p>
      Carbs Effect (mg/dL rise per gram):{" "}
      {approximatedProfile.carbsEffect.toFixed(2)}
      <br />
      Protein Effect (mg/dL rise per gram):{" "}
      {approximatedProfile.proteinEffect.toFixed(2)}
      <hr />
      <h3>Variants</h3>
      {originalInsulinVariants.map((v) => (
        <>
          {v.name}: {v.effect}mg/dL per unit
          <span style={{ marginLeft: "8px" }}>
            <Button
              onClick={() => optimizeForVariant(v.name)}
              variant="outline-primary"
              size="sm"
            >
              Optimize
            </Button>
          </span>
          <br />
        </>
      ))}
      <hr />
      {originalRescueVariants.map((v) => (
        <>
          {v.name}: {v.effect}mg/dL/{v.unitLetter}
          <span style={{ marginLeft: "8px" }}>
            <Button
              onClick={() => optimizeForVariant(v.name)}
              variant="outline-primary"
              size="sm"
            >
              Optimize
            </Button>
          </span>
          <br />
        </>
      ))}
      <h3>Optimized Variant Effects</h3>
      {insulinVariants.map((v, i) => (
        <>
          {v.name}: {v.effect}mg/dL per unit (from{" "}
          {originalInsulinVariants[i].effect})
          <br />
        </>
      ))}
      <hr />
      {rescueVariants.map((v, i) => (
        <>
          {v.name}: {v.effect}mg/dL/{v.unitLetter} (from{" "}
          {originalRescueVariants[i].effect})
          <br />
        </>
      ))}
    </>
  );
}
