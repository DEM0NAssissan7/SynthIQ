import { Button, Form } from "react-bootstrap";
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

  const [internalValue, setInternalValue] = useState(value);

  function updateValue(e: any) {
    const v = parseFloat(e.target.value);
    setValue(v);
    setInternalValue(v);
  }
  function centerSlider() {
    setInitialValue(value);
  }
  useEffect(() => {
    if (!initialized) {
      setInitialValue(value);
      setInternalValue(value);
      setInitialized(true);
    }
  }, []);
  return (
    <div style={{ width: "50%" }}>
      <Form.Label>
        {prettyName} [{internalValue}]
      </Form.Label>
      <Form.Range
        onChange={updateValue}
        min={0}
        max={Math.abs(initialValue) * 2 || 1}
        step={step || 0.01}
        value={internalValue}
      />
      <Button onClick={centerSlider} variant="secondary">
        Center
      </Button>
    </div>
  );
}

export default ProfileSlider;
