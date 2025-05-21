import { Form } from "react-bootstrap";

interface NutritionOffsetProps {
  label: string;
  value: number;
  setValue: (value: number) => void;
  iconClassName: string;
}

export default function NutritionOffset({
  label,
  value,
  setValue,
  iconClassName,
}: NutritionOffsetProps) {
  return (
    <Form.Group controlId="carbs-offset" className="mb-3">
      <Form.Label className="text-muted">{label}</Form.Label>
      <div className="input-group">
        <span className="input-group-text">
          <i className={iconClassName}></i>
        </span>
        <Form.Control
          type="number"
          value={value || ""} // controlled value
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setValue(!isNaN(value) ? value : 0);
          }}
        />
        <span className="input-group-text">g</span>
      </div>
    </Form.Group>
  );
}
