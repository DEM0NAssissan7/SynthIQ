import { useState, useEffect } from "react";
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
import { WizardStore } from "../storage/wizardStore";
import { BackendStore } from "../storage/backendStore";
import Insulin from "../models/events/insulin";
import type Session from "../models/session";
import { round } from "../lib/util";
import SugarReading from "../models/types/sugarReading";
import Card from "../components/Card";
import MdButton from "../components/md3/MdButton";
import MdIcon from "../components/md3/MdIcon";
import { PreferencesStore } from "../storage/preferencesStore";

export default function TestPage() {
  // Subscribe to templates store so any writes/updates trigger re-render
  const [templates] = WizardStore.templates.useState();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const sessions = WizardManager.getAllSessions()
    .slice()
    .filter(
      (a) =>
        a.insulins.length > 1 &&
        !a.isInvalid &&
        a.windows.length > 0 &&
        a.snapshot.readings.length > 0,
    )
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 30);

  // Auto-sync: on mount, if sessions only have calibrations and Nightscout is configured, pull CGM readings
  useEffect(() => {
    let cancelled = false;
    async function autoSyncMissingReadings() {
      if (!BackendStore.url.value) return;
      const needsSync = sessions.filter(
        (s) =>
          !s.snapshot.readings.some((r) => !r.isCalibration) &&
          s.snapshot.initialBG &&
          s.snapshot.finalBG,
      );
      if (needsSync.length === 0) return;
      setSyncing(true);
      setSyncStatus(`Auto-syncing CGM readings for ${needsSync.length} session(s)...`);
      let updatedCount = 0;
      for (const session of needsSync) {
        if (cancelled) break;
        try {
          await session.snapshot.pullReadings();
          updatedCount++;
        } catch (e) {
          console.error("Auto-sync pullReadings error:", e);
        }
      }
      if (!cancelled && updatedCount > 0) {
        WizardStore.templates.write();
        setSyncStatus(
          `Synced ${updatedCount} session(s) from Nightscout at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        );
      }
      if (!cancelled) setSyncing(false);
    }
    autoSyncMissingReadings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleManualSync = async () => {
    if (!BackendStore.url.value) {
      alert("Nightscout URL is not configured. Please check your Nightscout setup.");
      return;
    }
    setSyncing(true);
    setSyncStatus("Pulling latest CGM readings from Nightscout...");
    try {
      let updatedCount = 0;
      for (const session of sessions) {
        if (session.snapshot.initialBG && session.snapshot.finalBG) {
          await session.snapshot.pullReadings();
          updatedCount++;
        }
      }
      WizardStore.templates.write();
      setSyncStatus(
        `Successfully refreshed ${updatedCount} session(s) at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (e) {
      console.error("Manual sync failed:", e);
      setSyncStatus("Failed to sync readings from Nightscout. Check network and credentials.");
    } finally {
      setSyncing(false);
    }
  };

  const insulinVariants = InsulinVariantStore.variants.value;
  const rescueVariants = RescueVariantStore.variants.value;
  const info: [Session, Insulin[], Insulin[]][] = sessions.map((session) => {
    const [, , optimalInsulins, originalInsulins] =
      InsulinOptimizer.getOptimalInsulins(
        session.insulins,
        session.windows,
        insulinVariants,
        rescueVariants,
      );
    return [session, optimalInsulins, originalInsulins];
  });

  // Craft the CGM graph and the deltaCGM graph
  const data = info
    .map(([session, optimalInsulins, originalInsulins]) => {
      const readings = session.snapshot.readings
        .slice()
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      if (readings.length === 0) return null;

      // Calculate the theoretical based on the delta in bateman curves
      const deltaInsulins = originalInsulins.map((original, i) => {
        const optimal = optimalInsulins[i];
        const optimalValue =
          optimal && typeof optimal.value === "number"
            ? Math.max(0, optimal.value)
            : original.value;
        return new Insulin(
          optimalValue - original.value,
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
        session,
        data: readings.map((reading, i) => {
          return {
            session: reading.sugar - initialBGoffset,
            x: session.getN(reading.timestamp),
            optimal:
              optimals[i]?.sugar != null
                ? optimals[i].sugar - initialBGoffset
                : 0,
            isCalibration: reading.isCalibration,
          };
        }),
        insulins: deltaInsulins.map((insulin) => [
          session.getN(insulin.timestamp),
          insulin.value,
        ]),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <Card className="mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-1 fw-bold">Optimizer Test Lab</h5>
            <div className="small text-muted">
              Compare actual CGM traces against Bateman optimization curves
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <MdButton
              variant="tonal"
              disabled={syncing}
              onClick={handleManualSync}
              icon={<MdIcon name={syncing ? "sync" : "cloud_sync"} size={18} className={syncing ? "rotate-anim" : ""} />}
            >
              {syncing ? "Syncing..." : "Sync Nightscout"}
            </MdButton>
          </div>
        </div>
        {syncStatus && (
          <div className="mt-2 small text-primary d-flex align-items-center gap-1">
            <MdIcon name="info" size={16} />
            <span>{syncStatus}</span>
          </div>
        )}
        <div className="mt-3 pt-2 border-top d-flex flex-wrap gap-3 small text-muted align-items-center">
          <span className="d-inline-flex align-items-center gap-1">
            <span style={{ display: "inline-block", width: 14, height: 3, backgroundColor: "#626262", borderRadius: 1 }} />
            Session CGM Traces
          </span>
          <span className="d-inline-flex align-items-center gap-1">
            <span style={{ display: "inline-block", width: 8, height: 8, backgroundColor: "#ff9800", borderRadius: "50%", border: "1.5px solid #fff", boxShadow: "0 0 0 1px #ff9800" }} />
            Calibrations (Fingersticks)
          </span>
          <span className="d-inline-flex align-items-center gap-1">
            <span style={{ display: "inline-block", width: 14, height: 3, backgroundColor: "#3e7dcf", borderRadius: 1 }} />
            Model Optimal
          </span>
          <span className="d-inline-flex align-items-center gap-1">
            <span style={{ display: "inline-block", width: 14, height: 2, borderTop: "2px dashed #bd2727" }} />
            Insulin Delta
          </span>
        </div>
      </Card>

      {data.length === 0 ? (
        <Card>
          <div className="text-center text-muted p-4">
            No multi-dose sessions with treatment windows available for testing.
          </div>
        </Card>
      ) : (
        data.map(({ session, data: chartData, insulins }) => {
          const calibrationCount = chartData.filter((d) => d.isCalibration).length;
          const cgmCount = chartData.length - calibrationCount;
          const template = templates.find((t) =>
            t.sessions.some((s) => s.uuid === session.uuid),
          );
          const title = template?.name || "Session";
          return (
            <Card key={session.uuid} className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                <div>
                  <span className="fw-semibold">
                    {title}
                  </span>
                  <span className="text-muted small ms-2">
                    {session.timestamp.toLocaleDateString()} {session.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2 small">
                  <span className="badge bg-secondary-subtle text-secondary">
                    {cgmCount} CGM · {calibrationCount} Cal
                  </span>
                  {session.insulins.length > 0 && (
                    <span className="badge bg-primary-subtle text-primary">
                      {round(session.insulin, 1)}u Total
                    </span>
                  )}
                </div>
              </div>

              <ResponsiveContainer height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray={"3 3"} opacity={0.3} />
                  <XAxis
                    dataKey={"x"}
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => `${round(v, 1)}h`}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${round(v, 0)}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${round(Number(value), 1)} mg/dL`,
                      name === "session" ? "CGM Reading" : "Model Optimal",
                    ]}
                    labelFormatter={(label: any) => `Time: ${round(Number(label), 2)}h`}
                  />
                  {insulins.map(([x, value], idx) => (
                    <ReferenceLine
                      key={idx}
                      x={x}
                      stroke="#bd2727"
                      strokeDasharray="3 3"
                      label={{
                        value: `${value > 0 ? "+" : ""}${round(value, 1)}u`,
                        fill: "#c49d4a",
                        fontSize: 12,
                        position: "center",
                      }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey={"session"}
                    stroke="#626262"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload?.isCalibration) {
                        return (
                          <circle
                            key={`cal-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#ff9800"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      }
                      return (
                        <circle
                          key={`empty-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={0}
                          fill="none"
                        />
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dot={false}
                    dataKey={"optimal"}
                    stroke="#3e7dcf"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          );
        })
      )}
    </>
  );
}
