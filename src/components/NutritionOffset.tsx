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
    <Form.Group controlId={`offset-${label.toLowerCase().replace(/\s+/g, "-")}`} className="mb-0">
      <Form.Label className="small text-muted fw-semibold mb-1">{label}</Form.Label>
      <div className="input-group">
        <span className="input-group-text">
          <i className={iconClassName}></i>
        </span>
        <Form.Control
          type="number"
          placeholder="0"
          value={value || ""}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setValue(!isNaN(val) ? val : 0);
          }}
        />
        <span className="input-group-text small">g</span>
      </div>
    </Form.Group>
  );
}
