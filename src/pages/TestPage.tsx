import { InsulinOptimizer } from "../lib/helpers/insulinOptimizer";
import WizardManager from "../managers/wizardManager";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import Insulin from "../models/events/insulin";
import type Session from "../models/session";
import { round } from "../lib/util";
import SugarReading from "../models/types/sugarReading";
import Card from "../components/Card";
import { PreferencesStore } from "../storage/preferencesStore";

export default function TestPage() {
  const sessions = WizardManager.getAllSessions()
    .slice()
    .filter((a) => a.insulins.length > 1 && !a.isInvalid)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 30);
  const insulinVariants = InsulinVariantStore.variants.value;
  const rescueVariants = RescueVariantStore.variants.value;
  const info: [Session, Insulin[], Insulin[]][] = sessions.map((session) => {
    const [_, __, optimalInsulins, originalInsulins] =
      InsulinOptimizer.getOptimalInsulins(
        session.insulins,
        session.windows,
        insulinVariants,
        rescueVariants,
      );
    return [session, optimalInsulins, originalInsulins];
  });
  // Craft the CGM graph and the deltaCGM graph
  const data = info.map(([session, optimalInsulins, originalInsulins]) => {
    const readings = session.snapshot.readings
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    // Now the fun part: calculate the theoretical based on the delta in bateman curves
    const deltaInsulins = originalInsulins.map((original, i) => {
      const optimal = optimalInsulins[i];
      return new Insulin(
        Math.max(0, optimal.value) - original.value,
        original.timestamp,
        original.variant,
      );
    });
    const optimals = readings.map((r) => {
      const reading = new SugarReading(r.sugar, r.timestamp, r.isCalibration);
      deltaInsulins.forEach((i) => {
        reading.sugar -=
          i.batemanIntegral(i.timestamp, reading.timestamp) * i.variant.effect;
      });
      session.glucoses.forEach((g) => {
        if (g.timestamp.getTime() <= reading.timestamp.getTime())
          reading.sugar -= g.value * g.variant.effect;
      });
      return reading;
    });
    const initialBGoffset = readings[0].sugar - PreferencesStore.targetBG.value;
    return {
      data: readings.map((reading, i) => {
        return {
          session: reading.sugar - initialBGoffset,
          x: session.getN(reading.timestamp),
          optimal: optimals[i].sugar - initialBGoffset,
        };
      }),
      insulins: deltaInsulins.map((insulin) => [
        session.getN(insulin.timestamp),
        insulin.value,
      ]),
    };
  });

  return (
    <>
      {data.map(({ data, insulins }) => (
        <Card>
          <ResponsiveContainer height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray={"3 3"} />
              <XAxis dataKey={"x"} />
              <YAxis dataKey={"optimal"} />
              <Tooltip />
              {insulins.map(([x, value]) => (
                <ReferenceLine
                  x={x}
                  stroke="#bd2727"
                  strokeDasharray="3 3"
                  label={{
                    value: `${value > 0 ? "+" : ""}${round(value, 1)}u`,
                    fill: "#c6c6c6",
                    fontSize: 12,
                    position: "bottom",
                  }}
                />
              ))}
              <Line
                type="monotone"
                dot={false}
                dataKey={"session"}
                stroke="#626262"
              />
              <Line
                type="monotone"
                dot={false}
                dataKey={"optimal"}
                stroke="#3e7dcf"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ))}
    </>
  );
}
