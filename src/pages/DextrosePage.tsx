import Card from "../components/Card";
import { Form, InputGroup } from "react-bootstrap";
import { round } from "../lib/util";
import { DextroseStore } from "../storage/dextroseStore";
import { useMemo } from "react";
import {
  MetricGrid,
  MetricPill,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

export default function DextrosePage() {
  const [powderGlucoseContent, setPowderGlucoseContent] =
    DextroseStore.powderGlucoseContent.useState();
  const [powderMassContent, setPowderMassContent] =
    DextroseStore.powderMassContent.useState();
  const [totalSolution, setTotalSolution] =
    DextroseStore.totalSolution.useState();
  const [concentrationGlucose, setConcentrationGlucose] =
    DextroseStore.concentrationGlucose.useState();
  const [concentrationVolume, setConcentrationVolume] =
    DextroseStore.concentrationVolume.useState();

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
        <div className="app-card-title">
          <i className="bi bi-box-seam"></i>
          <span>Powder concentration</span>
        </div>
        <div className="row g-2 align-items-center">
          <div className="col-12 col-sm-6">
            <Form.Label className="small text-muted mb-1">Carbs</Form.Label>
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="decimal"
                step="any"
                value={powderGlucoseContent || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPowderGlucoseContent(!isNaN(val) ? val : 0);
                }}
              />
              <InputGroup.Text>g</InputGroup.Text>
            </InputGroup>
          </div>
          <div className="col-12 col-sm-6">
            <Form.Label className="small text-muted mb-1">Per powder mass</Form.Label>
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="decimal"
                step="any"
                value={powderMassContent || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPowderMassContent(!isNaN(val) ? val : 0);
                }}
              />
              <InputGroup.Text>g powder</InputGroup.Text>
            </InputGroup>
          </div>
        </div>
      </Card>

      <Card>
        <div className="app-card-title">
          <i className="bi bi-droplet"></i>
          <span>Target solution</span>
        </div>
        <div className="row g-2">
          <div className="col-12">
            <Form.Label className="small text-muted mb-1">Total solution volume</Form.Label>
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="decimal"
                step="any"
                value={totalSolution || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTotalSolution(!isNaN(val) ? val : 0);
                }}
              />
              <InputGroup.Text>ml</InputGroup.Text>
            </InputGroup>
          </div>
          <div className="col-12 col-sm-6">
            <Form.Label className="small text-muted mb-1">Target carbs</Form.Label>
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="decimal"
                step="any"
                value={concentrationGlucose || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConcentrationGlucose(!isNaN(val) ? val : 0);
                }}
              />
              <InputGroup.Text>g carbs</InputGroup.Text>
            </InputGroup>
          </div>
          <div className="col-12 col-sm-6">
            <Form.Label className="small text-muted mb-1">Per solution volume</Form.Label>
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="decimal"
                step="any"
                value={concentrationVolume || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConcentrationVolume(!isNaN(val) ? val : 0);
                }}
              />
              <InputGroup.Text>ml solution</InputGroup.Text>
            </InputGroup>
          </div>
        </div>
      </Card>

      <Card>
        <div className="app-card-title">
          <i className="bi bi-check2-circle"></i>
          <span>Mix result</span>
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
