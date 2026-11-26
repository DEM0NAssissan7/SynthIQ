import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import { StreamManager } from "../../managers/streamManager";
import { EntryStore } from "../../storage/entryStore";
import { Activity } from "../../models/events/activity";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useMemo } from "react";
import { PageActions, PageLayout } from "../../components/PageLayout";
import { useEnteredBG } from "../../state/useEnteredBG";

export default function ActivityStartPage() {
  const [currentBG, setCurrentBG, currentReading] = useEnteredBG();

  const [name] = EntryStore.activityName.useState();
  // The activity as it would be if started now, for its template's figures
  const activity = useMemo(
    () => ActivityManager.getActivitySession(new Activity(name, new Date(), 0)),
    [name],
  );

  const navigate = useNavigate();

  function start() {
    if (!currentBG) {
      alert(`Input your current blood sugar`);
      return;
    }
    if (confirm(`Are you ready to start your activity?`)) {
      const timestamp = new Date();
      StreamManager.markReading(currentReading);
      ActivityManager.begin(name, timestamp);
      navigate("/activity/end");
    }
  }
  function goToSelect() {
    navigate("/activity/select");
  }
  return (
    <PageLayout>
      <Card>
        <ActivitySummary activity={activity} currentBG={currentBG} />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
        />
      </Card>

      <PageActions inline>
        <Button onClick={goToSelect} variant="secondary">
          Go Back
        </Button>
        <Button variant="primary" onClick={start}>
          Start Activity
        </Button>
      </PageActions>
    </PageLayout>
  );
}
