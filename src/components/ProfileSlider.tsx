import { Button, Form } from "react-bootstrap";
import { metaProfile } from "../lib/metabolism";
import { useEffect, useState } from "react";

interface ProfileSliderProps {
  variable: string;
  prettyName?: string;
}

let initialValue: number;

function ProfileSlider({
  variable,
  prettyName = variable,
}: ProfileSliderProps) {
  const [val, changeVal] = useState(metaProfile.get(variable));

  function changeVar(val: number) {
    // changeVal(val);
    metaProfile.set(variable, val);
  }
  function updateValue(e: any) {
    changeVar(parseFloat(e.target.value));
  }
  if (!initialValue) initialValue = metaProfile.get(variable);
  // console.log(initialValue);
  return (
    <div style={{ width: "25%" }}>
      <Form.Label>
        {prettyName} [{val}]
      </Form.Label>
      <Form.Range
        onChange={updateValue}
        max={metaProfile.get(variable) * 2 || 1}
        step={0.01}
        // value={val}
      />
    </div>
  );
}

export default ProfileSlider;
