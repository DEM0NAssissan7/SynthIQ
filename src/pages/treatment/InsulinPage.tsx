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
      isMealRelated,
    [isMealRelated, session],
  );

  const meal = session.mealMarked ? session.latestMeal : WizardStore.meal.value;
  const [template] = WizardStore.template.useState();
  const baseSession = useMemo(
    () => template.getBaseSession(meal),
    [template, meal],
  );
  const [variant, setVariant] = useState(InsulinVariantManager.getDefault());

  // Inputted Insulin
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const markInsulin = (insulin: number) => {
    if (!currentGlucose && isMealRelated && !isFirstPostMealInjection) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (!isNaN(insulin)) {
      if (
        confirm(
          `Confirm that you have taken ${insulin} units of ${variant.name}`,
        )
      ) {
        // TODO: Use date selector
        const BG =
          currentGlucose ??
          session.initialGlucose ??
          PreferencesStore.targetBG.value;
        WizardManager.markInsulin(insulin, BG, variant.name, isMealRelated);

        goBack();
      }
    } else {
      alert("Please enter a valid number");
    }
  };

  const correctionInsulin = useMemo(() => {
    return currentGlucose ? getCorrectionInsulin(currentGlucose, variant) : 0;
  }, [currentGlucose, variant]);
  const vectorizedInsulins = template.vectorizeInsulin(meal, baseSession);
  const shotIndex = session.insulins.length;
  const overshootInsulinOffset =
    shotIndex < vectorizedInsulins.length
      ? getOvercompensationInsulins(
          currentGlucose && currentGlucose > 0
            ? currentGlucose
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
    if (session.ended) return correctionInsulin;
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
    const wasMealRelated = isMealRelated;
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
          isMealRelated
            ? "Review the suggested meal dose, confirm current glucose if needed, and mark insulin cleanly."
            : "Use this page for quick correction dosing without the extra noise."
        }
      />

      {isMealRelated && (
        <Card>
          <TemplateSummary
            template={template}
            session={session}
            meal={meal}
            currentBG={
              session.initialGlucose
                ? undefined
                : currentGlucose || PreferencesStore.targetBG.value
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
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Recommendation
        </div>
        <MetricGrid>
          <MetricPill
            label="Mode"
            value={
              session.started || session.meals.length !== 0 || isMealRelated
                ? "Meal or follow-up bolus"
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
        {!isFirstPostMealInjection && (
          <BloodSugarInput
            initialGlucose={currentGlucose}
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
