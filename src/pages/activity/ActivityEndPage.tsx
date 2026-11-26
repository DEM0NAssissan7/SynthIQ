import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useMemo } from "react";
import { PageActions, PageLayout } from "../../components/PageLayout";
import { EntryStore } from "../../storage/entryStore";
import { StreamManager } from "../../managers/streamManager";
import { Activity } from "../../models/events/activity";
import { getMinuteDiff } from "../../lib/timing";
import { useNow } from "../../state/useNow";
import { useStream } from "../../state/useStream";
import { useEnteredBG } from "../../state/useEnteredBG";

export default function ActivityEndPage() {
  const [currentBG, setCurrentBG, currentReading] = useEnteredBG();

  const [activity] = EntryStore.activity.useState();
  const now = useNow(60);
  const [, streamVersion] = useStream();
  // Still running: it spans until now, so rescues taken during it are counted
  const activitySession = useMemo(
    () =>
      ActivityManager.getActivitySession(
        new Activity(
          activity.name,
          activity.timestamp,
          getMinuteDiff(now, activity.timestamp),
          activity.uuid,
        ),
      ),
    [activity, now, streamVersion],
  );

  const navigate = useNavigate();

  function cancel() {
    if (
      confirm(
        `Are you sure you want to cancel your activity? This will completely disregard this session, and it will not be stored.`,
      )
    ) {
      ActivityManager.cancel();
      navigate("/hub");
    }
  }
  function end() {
    if (!currentBG) {
      alert(`Input your current blood sugar`);
      return;
    }
    if (confirm(`Are you ready to end your activity?`)) {
      const timestamp = new Date();
      StreamManager.markReading(currentReading);
      ActivityManager.end(timestamp);
      navigate("/hub");
    }
  }
  function takeGlucose() {
    navigate("/rescue");
  }
  return (
    <PageLayout>
      <Card>
        <ActivitySummary activity={activitySession} currentBG={currentBG} />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
        />
      </Card>

      <PageActions>
        <Button variant="danger" onClick={cancel}>
          Cancel Activity
        </Button>
        <Button variant="primary" onClick={takeGlucose}>
          Take Glucose
        </Button>
        <Button variant="primary" onClick={end}>
          End Activity
        </Button>
      </PageActions>
    </PageLayout>
  );
}
