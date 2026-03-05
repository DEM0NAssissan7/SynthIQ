import { Button } from "react-bootstrap";
import type Session from "../models/session";
import Card from "./Card";

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
      <h3>{title}</h3>
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">
          <br />
          <span className="text-muted">
            {session.age.toFixed(0)} days ago
            <br />
            Score: {session.score.toFixed(0)}
            <br />
            {session.insulin}u taken ({session.optimalMealInsulin.toFixed(0)}u
            optimal)
            <hr />
          </span>
          {session.firstMeal.addedFoods.map((f) => (
            <>
              {f.amount}
              {f.prettyUnit} {f.name}
              <br />
            </>
          ))}
        </span>
      </div>
      <br />
      <div className="pt-3 d-flex justify-content-end">
        <Button onClick={() => onselect(session)} variant={"primary"}>
          Select
        </Button>
      </div>
    </Card>
  );
}
