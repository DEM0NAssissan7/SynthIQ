import { Button } from "react-bootstrap";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import WizardManager from "../../managers/wizardManager";
import Card from "../../components/Card";
import {
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function WizardIntroPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // WizardManager.setState(WizardState.Intro, navigate);
  });
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Wizard"
        title="Meal creation wizard"
        subtitle="Move through meal setup, insulin timing, and session tracking with a calmer step-by-step flow."
      />
      <div className="alert alert-warning border shadow-sm">
        <strong>Warning:</strong> Never use this app for medical decisions.
        Always consult your healthcare provider. This app is for educational
        purposes only.
      </div>
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-3">
          Three steps
        </div>
        <div className="mb-3">
          <h2 className="h5 mb-1">1. Create your meal</h2>
          <p className="text-muted mb-0">
            Add foods, quantities, and any extra carbs or protein that matter.
          </p>
        </div>
        <div className="mb-3">
          <h2 className="h5 mb-1">2. Inject insulin or begin eating</h2>
          <p className="text-muted mb-0">
            Choose the timing that fits the session and confirm when the meal begins.
          </p>
        </div>
        <div>
          <h2 className="h5 mb-1">3. Review the session</h2>
          <p className="text-muted mb-0">
            Watch the live prediction, add treatments if needed, and close out with a final BG.
          </p>
        </div>
      </Card>
      <div className="d-grid">
        <Button
          variant="primary"
          onClick={() => {
            WizardManager.moveToFirstPage(navigate);
          }}
        >
          Continue
        </Button>
      </div>
    </PageLayout>
  );
}
