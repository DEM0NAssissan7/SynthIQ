import { useEffect, useState } from "react";
import BloodSugarInput from "../../components/BloodSugarInput";
import Card from "../../components/Card";
import { wizardStorage } from "../../storage/wizardStore";
import type Session from "../../models/session";
import { profile } from "../../storage/metaProfileStore";
import TemplateManager from "../../lib/templateManager";
import { TemplateState } from "../../models/types/templateState";
import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";
import RemoteReadings from "../../lib/remote/readings";

export default function TemplateFinalBGPage() {
  const session = wizardStorage.get("session") as Session;

  const [bloodSugar, setBloodSugar] = useState(profile.target);
  useEffect(() => {
    RemoteReadings.getCurrentSugar().then((a) => {
      if (a) setBloodSugar(a);
    });
  }, []);

  const navigate = useNavigate();
  function goBack() {
    TemplateManager.moveToPage(TemplateState.Hub, navigate);
  }
  function conclude() {
    if (confirm("Are you sure you want to end your session?")) {
      session.finalBG = bloodSugar;
      TemplateManager.startNew(navigate);
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
