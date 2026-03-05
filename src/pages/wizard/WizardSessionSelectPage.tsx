import { useNavigate } from "react-router";
import SessionSelection from "../../components/SessionSelection";
import WizardManager from "../../managers/wizardManager";
import type Session from "../../models/session";
import { WizardStore } from "../../storage/wizardStore";
import { Button } from "react-bootstrap";
import { WizardPage } from "../../models/types/wizardPage";
import { getDailyBasal, getFastingVelocity } from "../../lib/basal";

export default function WizardSessionSelectPage() {
  const navigate = useNavigate();
  const template = WizardStore.template.value;

  const bestSession = template.bestSession;
  const latestSession = template.latestSession;
  const typicalSession = template.typicalSession;
  const recommendedSession = template.recommendedSession;

  const now = new Date();
  const fastingVelocity = getFastingVelocity();
  const dailyBasal = getDailyBasal();

  const vectorizedClosestSession = template.getClosestSession(
    now,
    fastingVelocity,
    dailyBasal,
  );
  const vectorizedOptimalSession = template.getOptimalSession(
    now,
    fastingVelocity,
    dailyBasal,
  );

  function chooseSession(session: Session) {
    WizardManager.selectSession(session);
    WizardManager.begin(navigate);
  }
  function goBack() {
    WizardManager.moveToPage(WizardPage.Select, navigate);
  }
  return (
    <>
      <SessionSelection
        onselect={chooseSession}
        session={latestSession}
        title="Last Session"
      />
      <SessionSelection
        onselect={chooseSession}
        session={recommendedSession}
        title="Recommended Session"
      />
      {vectorizedOptimalSession && (
        <SessionSelection
          onselect={chooseSession}
          session={vectorizedOptimalSession}
          title="Metabolic Match (Controlled)"
        />
      )}
      {vectorizedClosestSession && (
        <SessionSelection
          onselect={chooseSession}
          session={vectorizedClosestSession}
          title="Metabolic Match (Recent)"
        />
      )}
      <SessionSelection
        onselect={chooseSession}
        session={typicalSession}
        title="Typical Session"
      />
      <SessionSelection
        onselect={chooseSession}
        session={bestSession}
        title="Optimal Score Session"
      />
      <Button onClick={goBack} variant={"secondary  "}>
        Go Back
      </Button>
    </>
  );
}
