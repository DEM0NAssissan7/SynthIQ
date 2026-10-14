import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../managers/wizardManager";
import { roundByHalf } from "../../lib/util";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import { getCorrectionInsulin } from "../../lib/metabolism";
import Card from "../../components/Card";
import MealSummary from "../../components/summary/MealSummary";
import { WizardStore } from "../../storage/wizardStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { NumberOptionSelector } from "../../components/NumberOptionSelector";
import InsulinVariantDropdown from "../../components/InsulinVariantDropdown";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageLayout,
} from "../../components/PageLayout";
import MdIcon from "../../components/md3/MdIcon";
import { estimateConstDeltaBG } from "../../lib/helpers/estimateConstDeltaBG";
import { useNow } from "../../state/useNow";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import { getTimestampFromOffset } from "../../lib/timing";
import {
  deriveInsulinPipelines,
  evaluateInsulinPipeline,
  type InsulinPipeline,
} from "../../lib/insulinPipeline";

interface DoseBreakdownItemProps {
  name: string;
  insulin: number;
}
function DoseBreakdownItem({ name, insulin }: DoseBreakdownItemProps) {
  if (insulin === 0) return <></>;
  return (
    <div className="app-dose-item">
      <span className="dose-name">
        <MdIcon name="syringe" className="text-primary" size={18} />
        <span>
          {name}
          {/* <span className="dose-sub ms-1">hi</span> */}
        </span>
      </span>
      <span className="dose-value">
        {insulin < 0 ? "" : "+"}
        {insulin.toFixed(1)}u
      </span>
    </div>
  );
}

export default function InsulinPage() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();
  const [activeTemplate] = WizardStore.activeTemplate.useState();
  const [isPrebolus, setIsPrebolus] = WizardStore.isPrebolus.useState();
  const now = useNow();
  const [readings] = HealthMonitorStore.readingsCache.useState();
  const [recentBoluses] = HealthMonitorStore.recentBoluses.useState();
  const [rescues] = HealthMonitorStore.lastRescues.useState();

  const [scratchpadMeal] = WizardStore.meal.useState();
  const meal = useMemo(
    () => (isPrebolus ? scratchpadMeal : session.meal),
    [isPrebolus, scratchpadMeal, session],
  );

  const isFirstPostMealInjection = useMemo(
    () =>
      !isPrebolus &&
      session.initialGlucose !== null &&
      session.insulins.length === 0 &&
      session.mealMarked,
    [isPrebolus, session],
  );

  const baseSession = useMemo(
    () => (meal ? template.getBaseSession(meal) : null),
    [template, meal],
  );
  const [variant, setVariant] = useState(InsulinVariantManager.getDefault());

  const [isCorrectionOnly, setIsCorrectionOnly] = useState(false);
  function toggleCorrectionOnly(enabled: boolean) {
    setIsCorrectionOnly(enabled);
    setInsulinEntry("");
  }

  // Inputted Insulin
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const currentBG =
    currentGlucose ??
    (isFirstPostMealInjection ? session.initialGlucose : null);

  const markInsulin = (insulin: number) => {
    const effectiveMealRelated = isPrebolus && !isCorrectionOnly;
    if (!currentBG && effectiveMealRelated && !isFirstPostMealInjection) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (isCorrectionOnly && !currentBG) {
      alert(`You must input your current blood sugar for a correction`);
      return;
    }
    if (!isNaN(insulin)) {
      if (
        confirm(
          `Confirm that you have taken ${insulin} units of ${variant.name}`,
        )
      ) {
        // TODO: Use date selector
        const BG = currentBG ?? PreferencesStore.targetBG.value;
        WizardManager.markInsulin(
          insulin,
          BG,
          variant.name,
          effectiveMealRelated,
        );

        goBack();
      }
    } else {
      alert("Please enter a valid number");
    }
  };

  const correctionInsulin = useMemo(() => {
    return currentBG ? getCorrectionInsulin(currentBG, variant) : 0;
  }, [currentBG, variant]);

  const overshootInsulin = useMemo(() => {
    if (!currentBG) return 0;
    if (isCorrectionOnly) return 0;
    const cappedCurrentBG = Math.min(
      currentBG,
      PreferencesStore.targetBG.value,
    );
    const baseTarget =
      PreferencesStore.targetBG.value - PreferencesStore.overshootOffset.value;
    return Math.max(cappedCurrentBG - baseTarget, 0) / variant.effect;
  }, [currentBG]);
  const [pipelines, optimalInsulins] = useMemo(
    () =>
      meal
        ? deriveInsulinPipelines(
            isPrebolus ? currentBG : (session.initialGlucose ?? currentBG),
            meal,
            baseSession,
            ["Overshoot", overshootInsulin],
          )
        : [[], []],
    [meal, isPrebolus, currentBG, session, baseSession, overshootInsulin],
  );
  const shotIndex = isPrebolus ? 0 : session.insulins.length;
  const fallbackPipeline = useMemo(
    () =>
      [
        ["Correction", correctionInsulin],
        ["Overshoot", overshootInsulin],
      ] as InsulinPipeline,
    [correctionInsulin, overshootInsulin],
  );
  const pipeline = useMemo(
    () => (pipelines.length > 0 ? pipelines[shotIndex] : fallbackPipeline),
    [pipelines, shotIndex, fallbackPipeline],
  );
  console.log(
    pipelines,
    isPrebolus,
    currentBG,
    isPrebolus ? currentBG : (session.initialGlucose ?? currentBG),
  );

  const projectedDuration = useMemo(() => variant.duration * 0.7, [variant]);
  const continuedRise = useMemo(() => {
    const future = getTimestampFromOffset(now, projectedDuration);
    const rise = estimateConstDeltaBG(
      readings,
      recentBoluses,
      rescues,
      now,
      future,
    );
    return rise;
  }, [now, projectedDuration, readings, recentBoluses, rescues]);
  const continuedRiseInsulin = useMemo(() => {
    const fractionAbsorbed = variant.unitBatemanIntegral(0, projectedDuration);
    return continuedRise / fractionAbsorbed / variant.effect;
  }, [projectedDuration, continuedRise, variant]);

  const risenCorrectionInsulin = correctionInsulin + continuedRiseInsulin;

  const displayedInsulin = useMemo(
    () => evaluateInsulinPipeline(pipeline),
    [pipeline],
  );
  const displayedRange: string = (() => {
    const correction = Math.max(roundByHalf(correctionInsulin), 0);
    const risenCorrection = Math.max(roundByHalf(risenCorrectionInsulin), 0);
    return correction === risenCorrection
      ? `${correction}`
      : `${Math.min(risenCorrection, correction)}u – ${Math.max(
          risenCorrection,
          correction,
        )}u`;
  })();

  const correctionIsDisplayed =
    isCorrectionOnly ||
    roundByHalf(displayedInsulin) === roundByHalf(correctionInsulin);

  function goBack() {
    const wasMealRelated = isPrebolus && !isCorrectionOnly;
    setIsPrebolus(false); // Reset flag
    navigate(wasMealRelated ? "/meal" : "/hub");
  }
  const [insulinTaken, setInsulinTaken] = useState(displayedInsulin);
  const [insulinEntry, setInsulinEntry] = useState("");
  useMemo(() => {
    if (insulinEntry.length === 0)
      setInsulinTaken(roundByHalf(displayedInsulin));
  }, [displayedInsulin]);
  function onMark() {
    markInsulin(insulinTaken);
  }

  // Set usage state based on the current session state
  useEffect(() => {
    setVariant(
      optimalInsulins[shotIndex]?.variant ?? InsulinVariantManager.getDefault(),
    );
  }, []);

  return (
    <PageLayout>
      {meal && !meal.isEmpty && (!session.insulinMarked || isPrebolus) && (
        <Card>
          <MealSummary
            template={template}
            meal={meal}
            mealName={template.name}
            currentBG={currentGlucose}
          />
        </Card>
      )}
      {session.meal && !session.insulinMarked && (
        <Card>
          <MealSummary
            template={activeTemplate}
            meal={session.meal}
            mealName={activeTemplate.name}
            session={session}
            currentBG={currentGlucose}
          />
        </Card>
      )}

      {/* Recommendation */}
      <Card>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="app-card-title mb-0">
            <MdIcon name="water_drop" className="text-primary" size={20} />
            <span>Recommendation</span>
          </div>
          <Form.Check
            type="switch"
            id="correction-only-toggle"
            label="Correction only"
            checked={isCorrectionOnly}
            disabled={!meal}
            onChange={(e) => toggleCorrectionOnly(e.target.checked)}
            className="small"
          />
        </div>
        <MetricGrid>
          <MetricPill
            label="Mode"
            value={
              isCorrectionOnly
                ? "Correction only"
                : isPrebolus
                  ? "Meal pre-bolus"
                  : session.insulins.length > 0
                    ? "Additional bolus"
                    : session.mealMarked
                      ? "Meal bolus"
                      : "Correction only"
            }
          />
          {!isPrebolus && (
            <>
              <MetricPill
                label="Suggested dose"
                value={
                  correctionIsDisplayed
                    ? displayedRange
                    : `${roundByHalf(displayedInsulin)}u`
                }
              />
              <MetricPill
                label={`Predicted ${continuedRise > 0 ? "Rise" : "Drop"} (${projectedDuration.toFixed(1)}hrs)`}
                value={`${continuedRise > 0 ? "+" : ""}${continuedRise.toFixed(0)}mg/dL`}
              />
            </>
          )}
        </MetricGrid>
        {pipeline && (
          <div className="d-flex flex-column gap-2 mt-1">
            <div className="app-dose-list">
              {pipeline.map((step) => (
                <DoseBreakdownItem name={step[0]} insulin={step[1]} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Mark insulin */}
      <Card>
        <div className="app-card-title">
          <MdIcon name="syringe" className="text-primary" size={20} />
          <span>Mark insulin</span>
        </div>
        {(!isFirstPostMealInjection || isCorrectionOnly) && (
          <BloodSugarInput
            initialGlucose={currentBG}
            setInitialGlucose={setCurrentGlucose}
            pullFromNightscout={true}
          />
        )}
        <InsulinVariantDropdown setVariant={setVariant} variant={variant} />
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <MdIcon name="syringe" size={18} />
          </InputGroup.Text>
          <Form.Control
            type="number"
            inputMode="decimal"
            step="any"
            placeholder={
              correctionIsDisplayed
                ? roundByHalf(correctionInsulin).toFixed(1)
                : `${roundByHalf(displayedInsulin)}u`
            }
            aria-describedby="basic-addon1"
            value={insulinEntry}
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setInsulinTaken(val);
              else setInsulinTaken(displayedInsulin);
              setInsulinEntry(e.target.value);
            }}
          />
          <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
        </InputGroup>
        <div className="w-100 mb-2">
          <NumberOptionSelector
            value={roundByHalf(displayedInsulin)}
            rangeFromOrigin={2}
            increment={0.5}
            labelSuffix="u"
            onSelect={(val) => {
              markInsulin(val);
            }}
          />
        </div>
      </Card>

      <PageActions>
        <Button variant="primary" onClick={onMark}>
          Mark Insulin
        </Button>
      </PageActions>
    </PageLayout>
  );
}
