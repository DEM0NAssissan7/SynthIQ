import { useEffect, useMemo, useState } from "react";
import useImportedSessionsState from "../state/useImportedSessionsState";
import Card from "../components/Card";
import { MathUtil } from "../lib/util";

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
    [importedSessions]
  );
  const protein = useMemo(
    () => importedSessions.map((s) => s.protein),
    [importedSessions]
  );
  const insulin = useMemo(
    () => importedSessions.map((s) => s.insulin),
    [importedSessions]
  );
  const glucose = useMemo(
    () => importedSessions.map((s) => s.glucose),
    [importedSessions]
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
      sessionReadings.forEach((r) => retval.push(r))
    );
    return retval;
  }, [readings]);

  return (
    <>
      <h1>Statistics</h1>
      <p>
        View information on your documented sessions <br />
        <i>{importedSessions.length} sessions imported</i>
      </p>
      <DataStatistics title="Carbs (g)" data={carbs} />
      <DataStatistics title="Protein (g)" data={protein} />
      <DataStatistics title="Insulin (u)" data={insulin} />
      <DataStatistics title="Glucose (caps)" data={glucose} />
      <DataStatistics title="Blood Sugar (mg/dL)" data={allReadings} />
    </>
  );
}
