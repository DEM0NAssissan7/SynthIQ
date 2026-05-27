import {
  Alert,
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  ToggleButton,
} from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import RemoteStorage from "../lib/remote/storage";
import type { KeyInterface } from "../storage/storageNode";
import { PrivateStore } from "../storage/privateStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { CalibrationStore } from "../storage/calibrationStore";
import { BackendStore } from "../storage/backendStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import StorageBackends from "../registries/storageBackends";
import { BasalStore } from "../storage/basalStore";
import { MasterState } from "../models/types/masterState";
import { downloadData, importData } from "../lib/dataTransfer";
import { PageHeader, PageLayout } from "../components/PageLayout";

interface Setting {
  title: string;
  keyInterface: KeyInterface<number>;
  iconClass: string;
  unit: string;
}
function NumberSetting({ title, keyInterface, iconClass, unit }: Setting) {
  const [, setValue] = keyInterface.useState();
  const [displayValue, setDisplayValue] = useState(
    keyInterface.value.toString(),
  );
  const initialValue = useMemo(() => keyInterface.value.toString(), []);
  return (
    <>
      <Form.Label htmlFor="basic-url">{title}</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className={iconClass}></i>
        </InputGroup.Text>
        <Form.Control
          type="number"
          placeholder={initialValue}
          value={displayValue}
          aria-describedby="basic-addon1"
          onChange={(a) => {
            const v = parseFloat(a.target.value);
            if (!Number.isNaN(v)) {
              setValue(v);
            }
            setDisplayValue(a.target.value);
          }}
        />
        <InputGroup.Text>{unit}</InputGroup.Text>
      </InputGroup>
    </>
  );
}
interface ToggleSettingParams {
  title: string;
  keyInterface: KeyInterface<boolean>;
}
function ToggleSetting({ title, keyInterface }: ToggleSettingParams) {
  const [val, setVal] = keyInterface.useState();
  return (
    <Form.Group className="mb-3 py-2">
      <Form.Check
        type="switch"
        label={title}
        checked={val}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setVal(e.target.checked)
        }
      />
    </Form.Group>
  );
}

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="small text-uppercase text-muted fw-semibold mb-1">
        {title}
      </div>
      {subtitle && <p className="text-muted mb-3">{subtitle}</p>}
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  function handleDownloadAllData() {
    downloadData();
    setImportMessage({
      variant: "success",
      text: "Downloaded a full local backup of your SynthIQ data.",
    });
  }

  async function handleImportData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (
        !confirm(
          `Are you sure you want to import data from "${file.name}"? This will overwrite ALL local user data.`,
        )
      ) {
        return;
      }

      await importData(file);
      location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import failed unexpectedly.";
      setImportMessage({
        variant: "danger",
        text: message,
      });
    } finally {
      e.target.value = "";
    }
  }

  function uploadStorage() {
    if (
      confirm(
        `Are you sure you want to upload data to backend? You will overwrite ALL user data on backend.`,
      )
    )
      RemoteStorage.upload();
  }
  async function downloadStorage() {
    if (
      confirm(
        `Are you sure you want to download data from backend? You will overwrite ALL local user data.`,
      )
    ) {
      const synced = await RemoteStorage.download(true);
      if (synced) location.reload();
      else console.warn(`Force download didn't work properly`);
    }
  }
  function clearData() {
    if (
      confirm(
        `Are you sure you want to clear ALL local data? This action cannot be reversed, and you will lose ALL local data.`,
      )
    ) {
      if (
        confirm(
          `Confirmation: Are you absolutely sure that you want to wipe ALL local data`,
        )
      ) {
        const backend = StorageBackends.getDefault();
        backend.clear();
        location.reload();
      }
    }
  }

  const syncOptions: [MasterState, string][] = [
    [MasterState.NONE, "Disabled"],
    [MasterState.SLAVE, "Slave"],
    [MasterState.TERMINAL, "Terminal"],
    [MasterState.MASTER, "Master"],
  ];
  const [selectedIndex, setSelectedIndex] = useState(
    PrivateStore.masterState.value.valueOf(),
  );
  function setSyncState(value: MasterState) {
    PrivateStore.masterState.value = value;
    setSelectedIndex(value.valueOf());
  }
  return (
    <PageLayout maxWidth="42rem">
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        subtitle="Keep system behavior, sync mode, basal settings, and data management in cleaner grouped sections."
      />
      <SettingsSection
        title="Data backup"
        subtitle="Export or import a full local backup."
      >
        <div className="d-flex flex-wrap gap-2">
          <Button onClick={handleDownloadAllData} variant="primary">
            Download Data
          </Button>
          <Button
            onClick={() => importInputRef.current?.click()}
            variant="outline-primary"
          >
            Import Data
          </Button>
          <Form.Control
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="d-none"
            onChange={handleImportData}
          />
        </div>
        {importMessage && (
          <Alert className="mt-3 mb-0" variant={importMessage.variant}>
            {importMessage.text}
          </Alert>
        )}
      </SettingsSection>
      <SettingsSection
        title="Remote storage"
        subtitle="Manually pull, push, or clear persisted data."
      >
        <div className="d-flex flex-wrap gap-2">
          <Button onClick={downloadStorage} variant="primary">
            Download From Backend
          </Button>
          <Button onClick={uploadStorage} variant="danger">
            Upload To Backend
          </Button>
          <Button onClick={clearData} variant="danger">
            Clear All Data
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title="Glucose thresholds">
        <NumberSetting
          keyInterface={PreferencesStore.highBG}
          title="High Blood Sugar Threshold"
          iconClass="bi bi-arrow-up-circle"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.lowBG}
          title="Low Blood Sugar Threshold"
          iconClass="bi bi-arrow-down-circle"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.dangerBG}
          title="Hypoglycemic Threshold"
          iconClass="bi bi-exclamation-octagon"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={HealthMonitorStore.dropTime}
          title="Rescue Predicted Drop Time"
          iconClass="bi bi-clock"
          unit="min"
        />
        <NumberSetting
          keyInterface={PreferencesStore.insulinMinActivity}
          title="Minimum Useful Insulin Effect"
          iconClass="bi bi-capsule"
          unit="mg/dL"
        />
      </SettingsSection>
      <SettingsSection
        title="Sync mode"
        subtitle="Choose how this client behaves when syncing with the wider system."
      >
        <ButtonGroup className="flex-wrap">
          {syncOptions.map((a, i) => (
            <ToggleButton
              key={i}
              id={`sync-radio-${i}`}
              type="radio"
              variant={
                (i === 0 && "outline-secondary") ||
                (i === 1 && "outline-primary") ||
                (i === 2 && "outline-warning") ||
                "outline-danger"
              }
              value={i}
              onChange={() => setSyncState(a[0])}
              checked={i === selectedIndex}
            >
              {a[1]}
            </ToggleButton>
          ))}
        </ButtonGroup>
      </SettingsSection>
      <SettingsSection title="Metabolic calibration">
        <NumberSetting
          keyInterface={CalibrationStore.carbsEffect}
          title="Carbs Effect (per gram)"
          iconClass="bi bi-cake2"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={CalibrationStore.proteinEffect}
          title="Protein Effect (per gram)"
          iconClass="bi bi-egg-fried"
          unit="mg/dL"
        />
      </SettingsSection>
      <SettingsSection title="Session timing">
        <NumberSetting
          keyInterface={BackendStore.cgmDelay}
          title="CGM Delay (in minutes)"
          iconClass="bi bi-clock"
          unit="min"
        />
        <NumberSetting
          keyInterface={PreferencesStore.overshootOffset}
          title="Bolus Target Overcompensation Offset"
          iconClass="bi bi-arrow-down-short"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.maxSessionLife}
          title="Max Session Storage Life"
          iconClass="bi bi-clock"
          unit="days"
        />
        <NumberSetting
          keyInterface={PreferencesStore.usableSessionLife}
          title="Usable Session Life"
          iconClass="bi bi-clock"
          unit="days"
        />
      </SettingsSection>
      <SettingsSection title="Basal schedule">
        <NumberSetting
          keyInterface={HealthMonitorStore.basalShotsPerDay}
          title="Basal Injections Per Day"
          iconClass="bi bi-capsule"
          unit="shots"
        />
        <NumberSetting
          keyInterface={HealthMonitorStore.basalShotTime}
          title="Basal Injection First Hour"
          iconClass="bi bi-clock"
          unit=""
        />
      </SettingsSection>
      <SettingsSection title="Other timing">
        <NumberSetting
          keyInterface={BasalStore.minTimeSinceMeal}
          title="Meal Effective Time"
          iconClass="bi bi-clock"
          unit="hours"
        />
        <NumberSetting
          keyInterface={PreferencesStore.sugarSaveTime}
          title="BG Box Expiration Time"
          iconClass="bi bi-clock"
          unit="mins"
        />
      </SettingsSection>
      <SettingsSection title="Application behavior">
        <ToggleSetting
          title="Enable Debug Logs"
          keyInterface={PrivateStore.debugLogs}
        />
        <ToggleSetting
          title="Upload Treatment to Nightscout"
          keyInterface={PreferencesStore.uploadToBackend}
        />
      </SettingsSection>
    </PageLayout>
  );
}
