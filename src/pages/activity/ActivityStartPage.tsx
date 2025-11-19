import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import { ActivityStore } from "../../storage/activityStore";
import Card from "../../components/Card";
import ActivitySummary from "../../components/ActivitySummary";
import { Button } from "react-bootstrap";
import { ActivityPage } from "../../models/types/activityPage";
import BloodSugarInput from "../../components/BloodSugarInput";
import { useState } from "react";

export default function ActivityStartPage() {
  const [currentBG, setCurrentBG] = useState<number | null>(null);

  const activity = ActivityStore.activity.value;
  const template = ActivityStore.template.value;

  const navigate = useNavigate();

  function start() {
    if (!currentBG) {
      alert(`Input your current blood sugar`);
      return;
    }
    if (confirm(`Are you ready to start your activity?`)) {
      ActivityManager.begin(navigate, currentBG);
    }
  }
  function goToSelect() {
    ActivityManager.navigateTo(navigate, ActivityPage.Select);
  }
  return (
    <>
      <Card>
        <ActivitySummary
          activity={activity}
          template={template}
          currentBG={currentBG}
        />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
        />
      </Card>
      <div className="d-flex justify-content-between align-items-center mt-3">
        {!activity.started && (
          <Button onClick={goToSelect} variant="secondary">
            Go Back
          </Button>
        )}
        <Button variant="primary" onClick={start}>
          Start Activity
        </Button>
      </div>
    </>
  );
}
