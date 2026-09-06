import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../managers/wizardManager";
import { roundByHalf } from "../../lib/util";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import {
  getCorrectionInsulin,
  getOvercompensationInsulins,
} from "../../lib/metabolism";
import Card from "../../components/Card";
import MealSummary from "../../components/summary/MealSummary";
import { WizardStore } from "../../storage/wizardStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { NumberOptionSelector } from "../../components/NumberOptionSelector";
import InsulinVariantDropdown from "../../components/InsulinVariantDropdown";
import { getFastingVelocity } from "../../lib/basal";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageLayout,
} from "../../components/PageLayout";

export default function InsulinPage() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [meal] = WizardStore.meal.useState();
  const [template] = WizardStore.template.useState();
  const [isPrebolus, setIsPrebolus] = WizardStore.isPrebolus.useState();

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

  const predictedOptimalInsulins = meal
    ? template.vectorizeInsulin(meal, baseSession)
    : [];
  const shotIndex = isPrebolus ? 0 : session.insulins.length;

  const overcompensationInsulins = useMemo(() => {
    if (
      isCorrectionOnly ||
      (!isPrebolus && session.completed) ||
      !meal ||
      meal.isEmpty
    )
      return [];
    return getOvercompensationInsulins(
      currentBG && currentBG > 0 ? currentBG : PreferencesStore.targetBG.value,
      predictedOptimalInsulins.length > 0
        ? predictedOptimalInsulins.map((i) => i.variant)
        : [variant],
    );
  }, [
    isCorrectionOnly,
    isPrebolus,
    session.completed,
    meal,
    currentBG,
    predictedOptimalInsulins,
    variant,
  ]);
  const overshootInsulin =
    shotIndex < overcompensationInsulins.length
      ? overcompensationInsulins[shotIndex]
      : 0;

  const continuedRiseInsulin = (() => {
    const fastingVelocity = getFastingVelocity(); // mg/dL per hour
    const insulinDuration = variant.duration; // hours
    const rise = fastingVelocity * insulinDuration;
    return rise / variant.effect;
  })();

  const risenCorrectionInsulin = correctionInsulin + continuedRiseInsulin;

  const displayedInsulin = useMemo(() => {
    // Insulin dosing pipeline
    let dose = 0;

    // Stage 1: Find raw unadjusted meal insulin
    const mealDose = (() => {
      // If we are correcting or if session is (somehow) complete, or no meal
      if (
        isCorrectionOnly ||
        (!isPrebolus && session.completed) ||
        !meal ||
        meal.isEmpty
      )
        return 0;
      // If this shot index is within the predicted optimal shots
      if (shotIndex < predictedOptimalInsulins.length) {
        return predictedOptimalInsulins[shotIndex].value;
      }
      // If we haven't taken any shots yet and predictedOptimalInsulins was empty, fall back to profile
      if (shotIndex === 0) {
        return template.getProfileInsulin(meal.carbs, meal.protein, variant);
      }
      // All predicted shots already taken, so no additional meal dose
      return 0;
    })();
    dose += mealDose;

    // Stage 2: Account for current BG correction
    dose += correctionInsulin;

    // Stage 3: Apply overcompensation offset (only for active meal shots)
    if (mealDose > 0) {
      dose += overshootInsulin;
    }

    return dose;
  }, [
    isCorrectionOnly,
    isPrebolus,
    session.completed,
    meal,
    shotIndex,
    predictedOptimalInsulins,
    template,
    variant,
    correctionInsulin,
    overshootInsulin,
  ]);
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
      predictedOptimalInsulins[shotIndex]?.variant ??
        InsulinVariantManager.getDefault(),
    );
  }, []);

  return (
    <PageLayout>
      {!meal.isEmpty && (!session.insulinMarked || isPrebolus) && (
        <Card>
          <MealSummary
            template={template}
            meal={meal}
            mealName={template.name}
          />
        </Card>
      )}

      {/* Recommendation */}
      <Card>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="app-card-title mb-0">
            <i className="bi bi-droplet-half text-primary" />
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
          <MetricPill
            label="Suggested dose"
            value={
              correctionIsDisplayed
                ? displayedRange
                : `${roundByHalf(displayedInsulin)}u`
            }
          />
        </MetricGrid>
      </Card>

      {/* Mark insulin */}
      <Card>
        <div className="app-card-title">
          <i className="bi bi-capsule text-primary" />
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
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            type="number"
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
