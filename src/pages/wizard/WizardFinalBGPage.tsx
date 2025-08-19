import { useEffect, useState } from "react";
import BloodSugarInput from "../../components/BloodSugarInput";
import Card from "../../components/Card";
import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";
import RemoteReadings from "../../lib/remote/readings";
import { WizardStore } from "../../storage/wizardStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import WizardManager from "../../managers/wizardManager";
import { WizardPage } from "../../models/types/wizardPage";

export default function WizardFinalBGPage() {
  const session = WizardStore.session.value;

  const [bloodSugar, setBloodSugar] = useState(PreferencesStore.targetBG.value);
  useEffect(() => {
    RemoteReadings.getCurrentSugar().then((a) => {
      if (a) setBloodSugar(a);
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
      session.finalBG = bloodSugar;
      WizardManager.startNew(navigate);
    }
  }
  return (
    <>
      <h1>Final Blood Sugar</h1>
      <p>
        Before ending the session, it's useful to have an accurate final blood
        glucose. You can use a blood sugar meter to get it, or you can simply
        let the app to infer it from your CGM.
      </p>
      <Card>
        <BloodSugarInput
          initialGlucose={bloodSugar}
          setInitialGlucose={setBloodSugar}
          pullFromNightscout={false}
          showAutoButton={false}
        />
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={goBack}>
          Go Back
        </Button>
        <Button variant="primary" onClick={conclude}>
          Conclude Session
        </Button>
      </div>
    </>
  );
}
