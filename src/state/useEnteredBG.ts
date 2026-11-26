import { useCallback, useState } from "react";
import type SugarReading from "../models/types/sugarReading";

/**
 * A blood sugar from BloodSugarInput: its value, and the reading it came
 * from (null when there is none). Record it with StreamManager.markReading,
 * at the time of the action it was entered for: only manual entries are new
 * readings, pulled ones are in the stream already.
 */
export function useEnteredBG(): [
  number | null,
  (value: number, reading: SugarReading | null) => void,
  SugarReading | null,
] {
  const [value, setValue] = useState<number | null>(null);
  const [reading, setReading] = useState<SugarReading | null>(null);
  const set = useCallback((value: number, reading: SugarReading | null) => {
    setValue(value);
    setReading(reading);
  }, []);
  return [value, set, reading];
}
