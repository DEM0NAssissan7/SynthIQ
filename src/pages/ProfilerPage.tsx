import { Button } from "react-bootstrap";
import ProfilerEventDisplay from "../components/ProfilerEventDisplay";
import ProfileSlider from "../components/ProfileSlider";
import useImportedMetaEventsState from "../state/useImportedMetaEventsState";
import useProfileState from "../state/useProfileState";
import NightscoutManager from "../lib/nightscoutManager";

export default function ProfilerPage() {
  const { importedEvents, clearIgnoredEvents, ignoreEvent } =
    useImportedMetaEventsState();
  const profile = useProfileState();

  function updateViews() {
    importedEvents.forEach((event) => event.notify());
    NightscoutManager.storeMetaProfile();
  }
  function pullNightscoutProfile() {
    if (
      confirm(
        "Are you sure you want to pull the Nightscout profile? This will overwrite your current profile."
      )
    ) {
      NightscoutManager.loadMetaProfile().then(() => {
        updateViews();
      });
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <Button onClick={updateViews}>Apply Changes</Button>
        <Button onClick={pullNightscoutProfile} variant="secondary">
          Use Nightscout Profile
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
            value={profile.insulin.halfLife}
            setValue={(value) => (profile.insulin.halfLife = value)}
            prettyName="Insulin Half-life (hours)"
          />
          <ProfileSlider
            value={profile.insulin.delay}
            setValue={(value) => (profile.insulin.delay = value)}
            prettyName="Insulin Delay (hours)"
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

        <div id="events">
          <Button variant="secondary" onClick={clearIgnoredEvents}>
            Unhide All
          </Button>
          {importedEvents.map((event, i) => (
            <ProfilerEventDisplay
              event={event}
              key={i}
              ignoreEvent={ignoreEvent}
              from={-1}
              until={
                event.endTimestamp
                  ? Math.floor(event.getN(event.endTimestamp)) + 1
                  : 16
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
