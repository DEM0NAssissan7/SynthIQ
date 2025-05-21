import { Form } from "react-bootstrap";
import { useEffect, useState } from "react";
import metaProfile from "../storage/metaProfileStore";

interface ProfileSliderProps {
  variable: string;
  prettyName?: string;
}

function ProfileSlider({
  variable,
  prettyName = variable,
}: ProfileSliderProps) {
  const [val, setVal] = useState(0);
  const [initialValue, setInitialValue] = useState(0);
  const [initialized, setInitialized] = useState(false);

  function changeVar(val: number) {
    setVal(val);
    metaProfile.set(variable, val);
  }
  function updateValue(e: any) {
    changeVar(parseFloat(e.target.value));
  }
  useEffect(() => {
    if (!initialized) {
      let v = metaProfile.get(variable);
      setInitialValue(v);
      setVal(v);
      setInitialized(true);
    }
  }, []);
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
        value={val}
      />
    </div>
  );
}

export default ProfileSlider;
