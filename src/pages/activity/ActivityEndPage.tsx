import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useMemo, useState } from "react";
import { PageActions, PageLayout } from "../../components/PageLayout";
import { EntryStore } from "../../storage/entryStore";

export default function ActivityEndPage() {
  const [currentBG, setCurrentBG] = useState<number | null>(null);

  const [activity] = EntryStore.activity.useState();
  const activitySession = useMemo(
    () => ActivityManager.getActivitySession(activity),
    [activity],
  );

  const navigate = useNavigate();

  function cancel() {
    if (
      confirm(
        `Are you sure you want to cancel your activity? This will completely disregard this session, and it will not be stored.`,
      )
    ) {
      ActivityManager.cancel();
    }
  }
  function end() {
    if (!currentBG) {
      alert(`Input your current blood sugar`);
      return;
    }
    if (confirm(`Are you ready to end your activity?`)) {
      ActivityManager.end(new Date());
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
