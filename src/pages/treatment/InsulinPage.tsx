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
import TemplateSummary from "../../components/summary/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { NumberOptionSelector } from "../../components/NumberOptionSelector";
import InsulinVariantDropdown from "../../components/InsulinVariantDropdown";
import { getFastingVelocity } from "../../lib/basal";
import LastBolusMessage from "../../components/LastBolusMessage";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function InsulinPage() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [isMealRelated, setIsMealRelated] =
    WizardStore.insulinIsMealRelated.useState();

  const isFirstPostMealInjection = useMemo(
    () =>
      session.initialGlucose !== null &&
      session.insulins.length === 0 &&
      session.mealMarked,
    [session],
  );

  const meal = isMealRelated ? WizardStore.meal.value : session.meal;
  const [template] = WizardStore.template.useState();
  const baseSession = useMemo(
    () => (meal ? template.getBaseSession(meal) : null),
    [template, meal],
  );
  const [variant, setVariant] = useState(InsulinVariantManager.getDefault());

  const [isCorrectionOnly, setIsCorrectionOnly] = useState(
    !meal || (!isMealRelated && session.readyToTransition),
  );

  function toggleCorrectionOnly(enabled: boolean) {
    setIsCorrectionOnly(enabled);
    setInsulinEntry("");
  }

  // Inputted Insulin
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const effectiveGlucose =
    currentGlucose ??
    (isFirstPostMealInjection ? session.initialGlucose : null);

  const markInsulin = (insulin: number) => {
    const effectiveMealRelated = isMealRelated && !isCorrectionOnly;
    if (
      !effectiveGlucose &&
      effectiveMealRelated &&
      !isFirstPostMealInjection
    ) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (isCorrectionOnly && !effectiveGlucose) {
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
        const BG = effectiveGlucose ?? PreferencesStore.targetBG.value;
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
    return effectiveGlucose
      ? getCorrectionInsulin(effectiveGlucose, variant)
      : 0;
  }, [effectiveGlucose, variant]);
  const vectorizedInsulins = meal
    ? template.vectorizeInsulin(meal, baseSession)
    : [];
  const shotIndex = session.insulins.length;
  const overshootInsulinOffset =
    shotIndex < vectorizedInsulins.length
      ? getOvercompensationInsulins(
          effectiveGlucose && effectiveGlucose > 0
            ? effectiveGlucose
            : PreferencesStore.targetBG.value,
          vectorizedInsulins.map((i) => i.variant),
        )[shotIndex]
      : 0;
  const continuedRiseInsulin = (() => {
    const fastingVelocity = getFastingVelocity(); // mg/dL per hour
    const insulinDuration = variant.duration; // hours
    const rise = fastingVelocity * insulinDuration;
    return rise / variant.effect;
  })();

  const risenCorrectionInsulin = correctionInsulin + continuedRiseInsulin;

  const extraInsulin = correctionInsulin + overshootInsulinOffset;
  const displayedInsulin = (() => {
    if (isCorrectionOnly || session.completed) {
      return correctionInsulin;
    }
    let insulin: number =
      vectorizedInsulins[shotIndex]?.value ?? -overshootInsulinOffset;
    return insulin + extraInsulin;
  })();
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

  function goBack() {
    const wasMealRelated = isMealRelated && !isCorrectionOnly;
    setIsMealRelated(false); // Reset flag
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

  const correctionIsDisplayed =
    isCorrectionOnly ||
    roundByHalf(displayedInsulin) === roundByHalf(correctionInsulin);

  // Set usage state based on the current session state
  useEffect(() => {
    setVariant(
      vectorizedInsulins[shotIndex]?.variant ??
        InsulinVariantManager.getDefault(),
    );
  }, []);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Treatment"
        title="Insulin dosing"
        subtitle={
          isMealRelated && !isCorrectionOnly
            ? "Review the suggested meal dose, confirm current glucose if needed, and mark insulin cleanly."
            : "Use this page for quick correction dosing without the extra noise."
        }
      />

      {meal && !isCorrectionOnly && (
        <Card>
          <TemplateSummary
            template={template}
            session={session}
            meal={meal}
            currentBG={
              session.initialGlucose
                ? undefined
                : effectiveGlucose || PreferencesStore.targetBG.value
            }
          />
        </Card>
      )}

      {/* Active insulin */}
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Active insulin
        </div>
        <LastBolusMessage />
      </Card>

      {/* Recommendation */}
      <Card>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="small text-uppercase text-muted fw-semibold">
            Recommendation
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
                : isMealRelated
                  ? "Meal pre-bolus"
                  : session.readyToTransition
                    ? "Correction only"
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
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Mark insulin
        </div>
        {(!isFirstPostMealInjection || isCorrectionOnly) && (
          <BloodSugarInput
            initialGlucose={effectiveGlucose}
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
        <div className="d-flex justify-content-center flex-wrap">
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

      <PageActions inline>
        <Button variant="secondary" onClick={goBack}>
          Go Back
        </Button>
        <Button variant="primary" onClick={onMark}>
          Mark Insulin
        </Button>
      </PageActions>
    </PageLayout>
  );
}
