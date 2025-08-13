import Reading from "../events/reading";
import type { Treatments } from "../treatments";
import type { DateRange } from "./types";

export interface StorageBackend {
  readonly name: string;
  getItem: (key: string) => string;
  setItem: (key: string, value: string) => void;
  clear: () => void;
}

export interface ReadingCollector {
  readonly name: string;
  getReadings: (dateRange: DateRange) => Promise<Reading[]>;
  getMethods: (ping: () => void) => {
    start: () => void;
    stop: () => void;
  };
}

export interface TreatmentCollector {
  start: () => void;
  stop: () => void;

  getTreatments: (dateRange: DateRange) => Treatments;
  putTreatments: (treatments: Treatments) => void;
}

export interface HealthMonitorService {
  start?: () => void;
  stop?: () => void;
  name: string;
  serviceHandler: () => {
    message: string;
    href: string;
  };
}
