import { useEffect, useMemo, useState } from "react";
import useImportedSessionsState from "../state/useImportedSessionsState";
import Card from "../components/Card";

interface DataStatisticsProps {
  title: string;
  data: number[];
}
function DataStatistics({ title, data }: DataStatisticsProps) {
  const min = useMemo(() => {
    if (data.length === 0) return 0;
    let min = Infinity;
    data.forEach((a) => {
      if (a < min) min = a;
    });
    return min;
  }, [data]);

  const max = useMemo(() => {
    if (data.length === 0) return 0;
    let max = -Infinity;
    data.forEach((a) => {
      if (a > max) max = a;
    });
    return max;
  }, [data]);

  const mean = useMemo(() => {
    if (data.length === 0) return 0;
    let retval = 0;
    data.forEach((a) => {
      retval += a;
    });
    retval = retval / data.length;
    return retval;
  }, [data]);

  const median = useMemo(() => {
    if (data.length === 0) return 0;
    const sortedArray = data.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 !== 0) return sortedArray[mid];
    else return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  }, [data]);

  const stdev = useMemo(() => {
    const denominator = data.length - 1;
    if (denominator <= 0) return 0;

    let sum = 0;
    data.forEach((a) => {
      sum += (mean - a) ** 2;
    });
    return Math.sqrt(sum / denominator);
  }, [data, mean]);
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
