import Card from "../components/Card";
import { Form, InputGroup } from "react-bootstrap";
import { round } from "../lib/util";
import type { KeyInterface } from "../storage/storageNode";
import { DextroseStore } from "../storage/dextroseStore";
import { useMemo } from "react";
import {
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

interface InputBoxParams {
  keyInterface: KeyInterface<number>;
  unit?: string;
}
function InputBox({ keyInterface, unit }: InputBoxParams) {
  const [value, setVal] = keyInterface.useState();

  return (
    <InputGroup
      size="sm"
      style={{ maxWidth: 100, display: "inline-flex", verticalAlign: "middle" }}
    >
      <Form.Control
        type="number"
        value={value || ""}
        onChange={(e) => {
          const value = parseFloat(e.target.value);
          setVal(!isNaN(value) ? value : 0);
        }}
      />
      {unit && (
        <InputGroup.Text style={{ padding: "2px 6px" }}>{unit}</InputGroup.Text>
      )}
    </InputGroup>
  );
}

export default function DextrosePage() {
  const [powderGlucoseContent] = DextroseStore.powderGlucoseContent.useState();
  const [powderMassContent] = DextroseStore.powderMassContent.useState();
  const [totalSolution] = DextroseStore.totalSolution.useState();
  const [concentrationGlucose] = DextroseStore.concentrationGlucose.useState();
  const [concentrationVolume] = DextroseStore.concentrationVolume.useState();

  const powderMass = useMemo(() => {
    let glucoseInPowder = powderGlucoseContent / powderMassContent;
    if (glucoseInPowder === 0) return 0;

    let gramsPerMl = concentrationGlucose / concentrationVolume;

    return (gramsPerMl * totalSolution) / glucoseInPowder;
  }, [
    powderGlucoseContent,
    powderMassContent,
    concentrationGlucose,
    concentrationVolume,
    totalSolution,
  ]);

  const waterVolume = useMemo(() => {
    return totalSolution - powderMass;
  }, [totalSolution, powderMass]);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Utility"
        title="Dextrose mixing"
        subtitle="Dial in powder ratios and final concentration without juggling the numbers by hand."
      />
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Powder concentration
        </div>
        <InputBox
          keyInterface={DextroseStore.powderGlucoseContent}
          unit="g"
        />{" "}
        carbs per{" "}
        <InputBox keyInterface={DextroseStore.powderMassContent} unit="g" />{" "}
        dextrose powder
      </Card>
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Target solution
        </div>
        Total solution:{" "}
        <InputBox keyInterface={DextroseStore.totalSolution} unit="ml" />
        <br />
        <br />
        Concentration:{" "}
        <InputBox
          keyInterface={DextroseStore.concentrationGlucose}
          unit="g"
        />{" "}
        carbs per{" "}
        <InputBox keyInterface={DextroseStore.concentrationVolume} unit="ml" />{" "}
        solution
      </Card>
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Mix result
        </div>
        <MetricGrid>
          <MetricPill
            label="Powder needed"
            value={`${round(powderMass, 0)}g`}
          />
          <MetricPill
            label="Water needed"
            value={`${round(waterVolume, 0)}ml`}
          />
        </MetricGrid>
      </Card>
    </PageLayout>
  );
}
