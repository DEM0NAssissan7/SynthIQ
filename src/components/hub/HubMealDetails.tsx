import { useNavigate } from "react-router";
import type Session from "../../models/session";
import Unit from "../../models/unit";
import MdIcon from "../md3/MdIcon";
import { round } from "../../lib/util";
import {
  formatClock,
  formatDose,
  formatDuration,
  formatRelative,
} from "./glucoseFormat";
import { formatGrams } from "./hubEvents";

const OFFSET_NAMES: Record<string, string> = {
  "Carbs Offset": "Extra carbs",
  "Protein Offset": "Extra protein",
  "Fat Offset": "Extra fat",
};

/** Minutes from the meal, phrased for a treatment ("12 min after"). */
function relativeToMeal(t: number, mealTime: number) {
  const min = Math.round((t - mealTime) / 60000);
  if (min === 0) return "with meal";
  return `${formatDuration(Math.abs(min))} ${min > 0 ? "after" : "before"}`;
}

/** Everything about one meal session: what was eaten, treatments, outcome. */
export default function HubMealDetails({
  session,
  nowMs,
  onNavigate,
}: {
  session: Session;
  nowMs: number;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const meal = session.meal;
  if (!meal) return null;
  const mealTime = meal.timestamp.getTime();
  const isCurrent = !session.completed;

  const foods = meal.summedFoods.filter((f) => Math.abs(f.amount) > 0);
  const status = session.isGarbage
    ? { label: "Excluded", cls: "is-excluded" }
    : session.completed
      ? { label: "Completed", cls: "" }
      : { label: "Active", cls: "is-active" };

  const start = session.initialGlucose;
  const peak = session.peakGlucose;
  const low = session.minGlucose;
  const end = session.finalBG;

  return (
    <div className="hub-meal">
      <div className="hub-meal-when">
        <span>
          {formatClock(mealTime)} · {formatRelative(mealTime, nowMs)}
        </span>
        <span className={`hub-meal-badge ${status.cls}`}>{status.label}</span>
      </div>

      <div className="hub-meal-macros">
        <div>
          <span>Net carbs</span>
          <strong>{formatGrams(meal.carbs)}</strong>
        </div>
        <div>
          <span>Protein</span>
          <strong>{formatGrams(meal.protein)}</strong>
        </div>
        <div>
          <span>Fat</span>
          <strong>{formatGrams(meal.fat)}</strong>
        </div>
        <div>
          <span>Calories</span>
          <strong>{Math.round(meal.calories)}</strong>
        </div>
      </div>

      <h3 className="hub-meal-heading">What was eaten</h3>
      {foods.length === 0 ? (
        <p className="hub-meal-empty">No foods recorded.</p>
      ) : (
        <ul className="hub-meal-list">
          {foods.map((f) => {
            const offset = OFFSET_NAMES[f.name];
            const amount = offset
              ? formatGrams(f.amount)
              : f.unit === Unit.Food.HundredGrams
                ? `${round(f.amount, 1)}g`
                : `× ${round(f.amount, 2)}`;
            return (
              <li key={f.name}>
                <span className="hub-meal-food">
                  <strong>{offset ?? f.name}</strong>
                  {!offset && (
                    <small>
                      {formatGrams(f.netCarbs)} carbs · {formatGrams(f.protein)}{" "}
                      protein
                    </small>
                  )}
                </span>
                <span className="hub-meal-amount">{amount}</span>
              </li>
            );
          })}
        </ul>
      )}

      {(session.insulins.length > 0 || session.glucoses.length > 0) && (
        <>
          <h3 className="hub-meal-heading">
            Treatments
            <span>
              {formatDose(session.insulin)}u
              {session.glucose > 0 && ` · ${formatGrams(session.glucose)}`}
            </span>
          </h3>
          <ul className="hub-meal-list">
            {session.insulins.map((ins, i) => (
              <li key={`i-${i}`}>
                <span className="hub-meal-food">
                  <strong>
                    <MdIcon name="syringe" size={14} fill className="me-1" />
                    {formatDose(ins.value)}u {ins.variant.name}
                  </strong>
                  <small>
                    {formatClock(ins.timestamp.getTime())} ·{" "}
                    {relativeToMeal(ins.timestamp.getTime(), mealTime)}
                  </small>
                </span>
              </li>
            ))}
            {session.glucoses.map((g, i) => (
              <li key={`g-${i}`}>
                <span className="hub-meal-food">
                  <strong>
                    <MdIcon name="water_drop" size={14} fill className="me-1" />
                    {g.value} × {g.variant.name}
                  </strong>
                  <small>
                    {formatClock(g.timestamp.getTime())} ·{" "}
                    {relativeToMeal(g.timestamp.getTime(), mealTime)}
                  </small>
                </span>
                <span className="hub-meal-amount">{formatGrams(g.carbs)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(start !== null || peak !== null || low !== null || end !== null) && (
        <>
          <h3 className="hub-meal-heading">Glucose</h3>
          <div className="hub-meal-macros">
            {start !== null && (
              <div>
                <span>Start</span>
                <strong>{start}</strong>
              </div>
            )}
            {peak !== null && (
              <div>
                <span>Peak</span>
                <strong>
                  {peak}
                  {start !== null && (
                    <small>
                      {" "}
                      ({peak - start >= 0 ? "+" : ""}
                      {peak - start})
                    </small>
                  )}
                </strong>
              </div>
            )}
            {low !== null && (
              <div>
                <span>Lowest</span>
                <strong>{low}</strong>
              </div>
            )}
            {end !== null && (
              <div>
                <span>End</span>
                <strong>{end}</strong>
              </div>
            )}
          </div>
        </>
      )}

      {isCurrent && (
        <div className="hub-sheet-actions mt-2">
          <button
            type="button"
            className="hub-sheet-action"
            onClick={() => {
              onNavigate();
              navigate("/session/edit");
            }}
          >
            <MdIcon name="edit_note" size={22} />
            <span>
              <strong>Edit session</strong>
              <small>
                Adjust stored foods, treatments, or glucose details.
              </small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
