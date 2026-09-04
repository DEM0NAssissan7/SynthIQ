import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { PageHeader, PageLayout } from "../components/PageLayout";
import SessionHubContent from "../components/SessionHubContent";
import BasalCard from "../components/BasalCard";
import { useMemo, useState } from "react";

function HubPage() {
  const now = useNow(60);

  const [dueForBasal, setDueForBasal] = useState(basalIsDue());
  useMemo(() => {
    setDueForBasal(basalIsDue());
  }, [now]);

  return (
    <PageLayout maxWidth="32rem">
      {dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}
      <>
        <PageHeader
          eyebrow="Wizard"
          title="Session hub"
          subtitle="Keep the current session readable while keeping glucose, activity, meal, and insulin actions close at hand."
        />
        <SessionHubContent />
      </>
      {!dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}
    </PageLayout>
  );
}

export default HubPage;
