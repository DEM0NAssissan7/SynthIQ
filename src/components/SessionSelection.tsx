import { Button } from "react-bootstrap";
import type Session from "../models/session";
import Card from "./Card";
import { MetricGrid, MetricPill } from "./PageLayout";

interface SessionSelectionProps {
  session: Session;
  title: string;
  onselect: (s: Session) => void;
}

export default function SessionSelection({
  session,
  title,
  onselect,
}: SessionSelectionProps) {
  return (
    <Card>
      <div className="small text-uppercase text-muted fw-semibold mb-1">
        Session Option
      </div>
      <h2 className="h5 mb-3">{title}</h2>
      <MetricGrid>
        <MetricPill label="Age" value={`${session.age.toFixed(0)} days ago`} />
        <MetricPill label="Score" value={session.score.toFixed(0)} />
        <MetricPill
          label="Insulin"
          value={`${session.insulin}u taken`}
        />
        <MetricPill
          label="Target"
          value={`${session.optimalMealInsulin.toFixed(0)}u optimal`}
        />
      </MetricGrid>
      <div className="mt-3">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Meal Snapshot
        </div>
        <div className="small">
          {session.firstMeal.addedFoods.map((f, index) => (
            <div key={`${f.name}-${index}`} className="mb-1">
              {f.amount}
              {f.prettyUnit} {f.name}
            </div>
          ))}
        </div>
      </div>
      <div className="d-grid mt-3">
        <Button onClick={() => onselect(session)} variant="primary">
          Select
        </Button>
      </div>
    </Card>
  );
}
