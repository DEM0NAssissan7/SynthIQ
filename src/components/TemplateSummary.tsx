import { Button } from "react-bootstrap";
import { useMemo, useState } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type Session from "../models/session";
import type MealTemplate from "../models/mealTemplate";
import TemplateMealSummary from "./TemplateMealSummary";
import { useNow } from "../state/useNow";
import { MetricGrid, MetricPill } from "./PageLayout";

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

interface TemplateSummaryProps {
  template: MealTemplate;
  session: Session;
  meal?: Meal;
  currentBG?: number;
}

export default function TemplateSummary({
  template,
  session,
  meal,
  currentBG,
}: TemplateSummaryProps) {
  const now = useNow();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const elapsedMinutes = useMemo(
    () => getMinuteDiff(now, session.timestamp),
    [now, session.timestamp],
  );
  const elapsedFormatted = getFormattedTime(elapsedMinutes);

  const hasMeals = session.meals.length > 0;
  const insulinTotal = session.insulin;

  return (
    <>
      {/* Header row: template name + elapsed time */}
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="app-kicker mb-1">Session</div>
          <h2 className="h5 mb-0">{template.name}</h2>
        </div>
        <span className="badge bg-secondary-subtle text-secondary-emphasis fs-6 fw-normal px-3 py-2">
          {elapsedFormatted}
        </span>
      </div>

      {/* Key metrics */}
      <MetricGrid>
        {insulinTotal > 0 && (
          <MetricPill
            label="Total insulin"
            value={`${formatDose(insulinTotal)}u`}
          />
        )}
        {insulinTotal > 0 && session.latestInsulinTimestamp && (
          <MetricPill
            label="Last dose"
            value={`${getFormattedTime(getMinuteDiff(now, session.latestInsulinTimestamp))} ago`}
          />
        )}
        {session.glucose > 0 && (
          <MetricPill
            label="Glucose"
            value={`${session.glucose.toFixed(1)}g (${session.glucoseDoses})`}
          />
        )}
      </MetricGrid>

      {/* Advanced info toggle */}
      <div className="d-grid gap-2 mt-3">
        <Button
          variant="outline-secondary"
          size="sm"
          className="fw-semibold"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "Hide details" : "Show details"}
        </Button>
      </div>

      {showAdvanced && (
        <div className="mt-3 pt-3 border-top">
          {/* Starting BG */}
          {session.initialGlucose && (
            <div className="d-flex justify-content-between py-1 small">
              <span className="text-muted">Starting BG</span>
              <span className="fw-semibold">{session.initialGlucose} mg/dL</span>
            </div>
          )}

          {/* Session start time */}
          {session.started && (
            <div className="d-flex justify-content-between py-1 small">
              <span className="text-muted">Started at</span>
              <span className="fw-semibold">{getPrettyTime(session.timestamp)}</span>
            </div>
          )}

          {/* Meal-specific breakdown (only when a meal is explicitly passed) */}
          {meal && (
            <>
              <hr className="my-2" />
              <TemplateMealSummary
                template={template}
                meal={meal}
                currentBG={currentBG ?? session.initialGlucose ?? 0}
              />
            </>
          )}

          {/* Macronutrients */}
          {hasMeals && (
            <>
              <hr className="my-2" />
              <div className="small text-uppercase text-muted fw-semibold mb-1">
                Nutrition
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Carbs</span>
                <span className="fw-semibold">
                  {round(session.carbs, 0)}g
                  {session.carbs !== session.totalCarbs && (
                    <span className="text-muted fw-normal">
                      {" "}({round(session.totalCarbs, 0)}g total)
                    </span>
                  )}
                </span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Protein</span>
                <span className="fw-semibold">{round(session.protein, 0)}g</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Fat</span>
                <span className="fw-semibold">{round(session.fat, 0)}g</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Calories</span>
                <span className="fw-semibold">{round(session.calories, 0)} kcal</span>
              </div>
            </>
          )}

          {/* Activities */}
          {session.activities.length > 0 && (
            <>
              <hr className="my-2" />
              <div className="small text-uppercase text-muted fw-semibold mb-1">
                Activities
              </div>
              {session.activities.map((a, i) => (
                <div key={i} className="d-flex justify-content-between py-1 small">
                  <span>{a.name}</span>
                  <span className="fw-semibold">{getFormattedTime(a.length)}</span>
                </div>
              ))}
            </>
          )}

          {/* Flags */}
          {(template.isFirstTime || session.isInvalid) && (
            <>
              <hr className="my-2" />
              {template.isFirstTime && (
                <div className="small text-warning-emphasis">
                  <i className="bi bi-info-circle me-1" />
                  First time using this template
                </div>
              )}
              {session.isInvalid && (
                <div className="small text-danger-emphasis">
                  <i className="bi bi-exclamation-triangle me-1" />
                  Session is currently invalid
                </div>
              )}
            </>
          )}

          {/* Session notes */}
          {session.notes && (
            <>
              <hr className="my-2" />
              <div className="small text-muted">{session.notes}</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
