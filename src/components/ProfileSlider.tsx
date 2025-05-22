import { Form } from "react-bootstrap";
import { useEffect, useState } from "react";

interface ProfileSliderProps {
  value: number;
  setValue: (value: number) => void;
  prettyName: string;
  step?: number;
}

function ProfileSlider({
  value,
  setValue,
  prettyName,
  step,
}: ProfileSliderProps) {
  const [initialValue, setInitialValue] = useState(0);
  const [initialized, setInitialized] = useState(false);

  function updateValue(e: any) {
    setValue(parseFloat(e.target.value));
  }
  useEffect(() => {
    if (!initialized) {
      setInitialValue(value);
      setInitialized(true);
    }
  }, []);
  // console.log(initialValue);
  return (
    <div style={{ width: "50%" }}>
      <Form.Label>
        {prettyName} [{value}]
      </Form.Label>
      <Form.Range
        onChange={updateValue}
        max={initialValue * 2 || 1}
        step={step || 0.01}
        value={value}
      />
    </div>
  );
}

export default ProfileSlider;
