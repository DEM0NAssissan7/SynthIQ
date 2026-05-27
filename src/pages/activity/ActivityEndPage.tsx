import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import { ActivityStore } from "../../storage/activityStore";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useState } from "react";
import {
  PageActions,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function ActivityEndPage() {
  const [currentBG, setCurrentBG] = useState<number | null>(null);

  const activity = ActivityStore.activity.value;
  const template = ActivityStore.template.value;

  const navigate = useNavigate();

  function cancel() {
    if (
      confirm(
        `Are you sure you want to cancel your activity? This will completely disregard this session, and it will not be stored.`
      )
    ) {
      ActivityManager.cancel(navigate);
    }
  }
  function end() {
    if (!currentBG) {
      alert(`Input your current blood sugar`);
      return;
    }
    if (confirm(`Are you ready to end your activity?`)) {
      ActivityManager.end(navigate, currentBG);
    }
  }
  function takeGlucose() {
    navigate("/rescue");
  }
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Activity"
        title="Finish activity"
        subtitle="Wrap up the activity with a clean final glucose entry, or jump to rescue treatment if you need it."
      />
      <Card>
        <ActivitySummary
          activity={activity}
          template={template}
          currentBG={activity.initialBG}
        />
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
