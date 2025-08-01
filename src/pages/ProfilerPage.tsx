import { Button } from "react-bootstrap";
import ProfilerSessionDisplay from "../components/ProfilerSessionDisplay";
import ProfileSlider from "../components/ProfileSlider";
import useImportedSessionsState from "../state/useImportedSessionsState";
import useProfileState from "../state/useProfileState";
import { optimizeSessions } from "../lib/optimizer";

export default function ProfilerPage() {
  const { importedSessions, clearIgnoredSessions, ignoreSession } =
    useImportedSessionsState();
  const profile = useProfileState();

  function notifySessions() {
    importedSessions.forEach((session) => session.notify());
  }
  function updateViews() {
    notifySessions();
  }
  function onOptimize() {
    notifySessions();
  }
  function optimizeAll() {
    optimizeSessions(importedSessions, profile, notifySessions);
  }
  function upload() {
    // NightscoutManager.storeMetaProfile();
  }
  function pullNightscoutProfile() {
    if (
      confirm(
        "Are you sure you want to pull the Nightscout profile? This will overwrite your current profile."
      )
    ) {
      // NightscoutManager.loadMetaProfile().then(() => {
      //   updateViews();
      // });
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <Button onClick={updateViews} variant="primary">
          Apply Changes
        </Button>
        <Button onClick={pullNightscoutProfile} variant="danger">
          Use Nightscout Profile
        </Button>
        <Button onClick={upload} variant="secondary">
          Upload Profile
        </Button>
      </div>
      <div style={{ display: "flex" }}>
        <div
          id="sliders"
          style={{
            minWidth: 350,
            maxWidth: 350,
            flexShrink: 0,
            marginRight: 32,
          }}
        >
          <ProfileSlider
            value={profile.insulin.effect}
            setValue={(value) => (profile.insulin.effect = value)}
            prettyName="Insulin Effect (points/u)"
          />
          <ProfileSlider
            value={profile.insulin.delay}
            setValue={(value) => (profile.insulin.delay = value)}
            prettyName="Insulin Delay (hours)"
          />
          <ProfileSlider
            value={profile.insulin.absorptionRate}
            setValue={(value) => (profile.insulin.absorptionRate = value)}
            prettyName="Insulin Absorption Rate"
          />
          <ProfileSlider
            value={profile.insulin.eliminationRate}
            setValue={(value) => (profile.insulin.eliminationRate = value)}
            prettyName="Insulin Elimination Rate"
          />

          <br />
          <ProfileSlider
            value={profile.carbs.effect}
            setValue={(value) => (profile.carbs.effect = value)}
            prettyName="Carbs Effect (points/g)"
          />
          <ProfileSlider
            value={profile.carbs.peak}
            setValue={(value) => (profile.carbs.peak = value)}
            prettyName="Carbs Peak (hours)"
          />
          <ProfileSlider
            value={profile.carbs.delay}
            setValue={(value) => (profile.carbs.delay = value)}
            prettyName="Carbs Delay (hours)"
          />

          <br />
          <ProfileSlider
            value={profile.protein.effect}
            setValue={(value) => (profile.protein.effect = value)}
            prettyName="Protein Effect (points/g)"
          />
          <ProfileSlider
            value={profile.protein.delay}
            setValue={(value) => (profile.protein.delay = value)}
            prettyName="Protein Delay (hours)"
          />
          <ProfileSlider
            value={profile.protein.minTime}
            setValue={(value) => (profile.protein.minTime = value)}
            prettyName="Protein Minimum Digestion Time (hours)"
          />
          <ProfileSlider
            value={profile.protein.plateuRate}
            setValue={(value) => (profile.protein.plateuRate = value)}
            prettyName="Protein Sustain Rate (hours/g)"
            step={0.001}
          />
          <br />
          <ProfileSlider
            value={profile.glucose.effect}
            setValue={(value) => (profile.glucose.effect = value)}
            prettyName="Dextrose Effect (points/cap)"
          />
          <ProfileSlider
            value={profile.glucose.delay}
            setValue={(value) => (profile.glucose.delay = value)}
            prettyName="Dextrose Delay (hours)"
          />
          <ProfileSlider
            value={profile.glucose.peak}
            setValue={(value) => (profile.glucose.peak = value)}
            prettyName="Dextrose Peak Time (hours)"
          />
        </div>

        <div id="sessions">
          <Button variant="secondary" onClick={clearIgnoredSessions}>
            Unhide All
          </Button>
          <Button variant="primary" onClick={optimizeAll}>
            Optimize All
          </Button>
          {importedSessions.map((session, i) => (
            <ProfilerSessionDisplay
              session={session}
              key={i}
              ignoreSession={ignoreSession}
              onOptimize={onOptimize}
              from={-1}
              until={
                session.endTimestamp
                  ? Math.floor(session.getN(session.endTimestamp))
                  : 16
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
