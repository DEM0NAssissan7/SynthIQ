import { useEffect, useState } from "react";
import BloodSugarInput from "../../components/BloodSugarInput";
import Card from "../../components/Card";
import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";
import RemoteReadings from "../../lib/remote/readings";
import { PreferencesStore } from "../../storage/preferencesStore";
import WizardManager from "../../managers/wizardManager";
import { WizardPage } from "../../models/types/wizardPage";
import {
  PageActions,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function WizardFinalBGPage() {
  const [bloodSugar, setBloodSugar] = useState(PreferencesStore.targetBG.value);
  useEffect(() => {
    RemoteReadings.getCurrentSugar().then((a) => {
      if (a) setBloodSugar(a.sugar);
    });
  }, []);

  const navigate = useNavigate();
  function goBack() {
    WizardManager.moveToPage(WizardPage.Hub, navigate);
  }
  function conclude() {
    if (!bloodSugar) {
      alert(`You must input a proper final blood sugar`);
      return;
    }
    if (confirm("Are you sure you want to end your session?")) {
      WizardManager.endSession(bloodSugar);
      WizardManager.startNew(navigate);
    }
  }
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Wizard"
        title="Final blood sugar"
        subtitle="Capture the closing BG so the session stores a cleaner result for later review."
      />
      <Card>
        <BloodSugarInput
          initialGlucose={bloodSugar}
          setInitialGlucose={setBloodSugar}
          pullFromNightscout={false}
          showAutoButton={false}
        />
      </Card>
      <PageActions inline>
        <Button variant="secondary" onClick={goBack}>
          Go Back
        </Button>
        <Button variant="primary" onClick={conclude}>
          Conclude Session
        </Button>
      </PageActions>
    </PageLayout>
  );
}
