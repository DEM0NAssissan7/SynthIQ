import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import { ActivityStore } from "../../storage/activityStore";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useState } from "react";

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
    <>
      <Card>
        <ActivitySummary activity={activity} template={template} />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
        />
      </Card>
      <div className="d-flex justify-content-between align-items-center mt-3">
        <Button variant="danger" onClick={cancel}>
          Cancel Activity
        </Button>
        <Button variant="primary" onClick={takeGlucose}>
          Take Glucose
        </Button>
        <Button variant="primary" onClick={end}>
          End Activity
        </Button>
      </div>
    </>
  );
}
