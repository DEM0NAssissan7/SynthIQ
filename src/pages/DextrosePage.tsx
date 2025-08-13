import Card from "../components/Card";
import { Form, InputGroup } from "react-bootstrap";
import { round } from "../lib/util";
import type { KeyInterface } from "../storage/storageNode";
import { DextroseStore } from "../storage/dextroseStore";
import { useMemo } from "react";

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
    <>
      <h1>Dextrose Mixing</h1>
      <Card>
        <h3>Powder Concentration</h3>
        <InputBox
          keyInterface={DextroseStore.powderGlucoseContent}
          unit="g"
        />{" "}
        carbs per{" "}
        <InputBox keyInterface={DextroseStore.powderMassContent} unit="g" />{" "}
        dextrose powder
      </Card>
      <Card>
        <h3></h3>
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
        Mix <b>{round(powderMass, 0)}g</b> of dextrose powder with{" "}
        <b>{round(waterVolume, 0)}ml</b> of water
      </Card>
    </>
  );
}
