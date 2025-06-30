import { useState } from "react";
import Card from "../components/Card";
import useStorageNode from "../state/useStorageNode";
import dextroseStore from "../storage/dextroseStore";
import { Form, InputGroup } from "react-bootstrap";
import type StorageNode from "../lib/storageNode";
import { round } from "../lib/util";

interface InputBoxParams {
  store: StorageNode;
  name: string;
  unit?: string;
}
function InputBox({ store, name, unit }: InputBoxParams) {
  const [val, setVal] = useState(store.get(name));

  return (
    <InputGroup
      size="sm"
      style={{ maxWidth: 100, display: "inline-flex", verticalAlign: "middle" }}
    >
      <Form.Control
        type="number"
        value={val || ""}
        onChange={(e) => {
          setVal(e.target.value);
          const value = parseFloat(e.target.value);
          store.set(name, !isNaN(value) ? value : 0);
        }}
      />
      {unit && (
        <InputGroup.Text style={{ padding: "2px 6px" }}>{unit}</InputGroup.Text>
      )}
    </InputGroup>
  );
}

export default function DextrosePage() {
  const store = useStorageNode(dextroseStore);

  function getPowderMass() {
    let glucoseInPowder =
      store.get("powderGlucoseContent") / store.get("powderMassContent");
    if (glucoseInPowder === 0) return 0;

    let gramsPerMl =
      store.get("concentrationGlucose") / store.get("concentrationVolume");

    return (gramsPerMl * store.get("totalSolution")) / glucoseInPowder;
  }

  function getWaterVolume() {
    return store.get("totalSolution") - getPowderMass();
  }

  return (
    <>
      <h1>Dextrose Mixing</h1>
      <Card>
        <h3>Powder Concentration</h3>
        <InputBox store={store} name={"powderGlucoseContent"} unit="g" /> carbs
        per <InputBox store={store} name={"powderMassContent"} unit="g" />{" "}
        dextrose powder
      </Card>
      <Card>
        <h3></h3>
        Total solution:{" "}
        <InputBox store={store} name={"totalSolution"} unit="ml" />
        <br />
        <br />
        Concentration:{" "}
        <InputBox store={store} name={"concentrationGlucose"} unit="g" /> carbs
        per <InputBox store={store} name={"concentrationVolume"} unit="ml" />{" "}
        solution
      </Card>
      <Card>
        Mix <b>{round(getPowderMass(), 0)}g</b> of dextrose powder with{" "}
        <b>{round(getWaterVolume(), 0)}ml</b> of water
      </Card>
    </>
  );
}
