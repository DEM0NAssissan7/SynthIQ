import { Form } from "react-bootstrap";
import { metaProfile } from "../lib/metabolism";
import { useState } from "react";

interface ProfileSliderProps {
  variable: string;
  prettyName?: string;
}

let initialValue: number;
let initialized: boolean = false;

function ProfileSlider({
  variable,
  prettyName = variable,
}: ProfileSliderProps) {
  const [val, changeVal] = useState(metaProfile.get(variable));

  function changeVar(val: number) {
    changeVal(val);
    metaProfile.set(variable, val);
  }
  function updateValue(e: any) {
    changeVar(parseFloat(e.target.value));
  }
  if (!initialized) {
    initialValue = metaProfile.get(variable);
    initialized = true;
  }
  // console.log(initialValue);
  return (
    <div style={{ width: "50%" }}>
      <Form.Label>
        {prettyName} [{val}]
      </Form.Label>
      <Form.Range
        onChange={updateValue}
        max={initialValue * 2 || 1}
        step={0.01}
        // value={val}
      />
    </div>
  );
}

export default ProfileSlider;
