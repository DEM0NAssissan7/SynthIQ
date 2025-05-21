import { useEffect, useState } from "react";
import { convertDimensions } from "../lib/util";
import Unit from "../models/unit";

export default function useVersion(intervalMinutes: number) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const versionHandler = () => setVersion(version + 1);
    const id = setInterval(
      versionHandler,
      intervalMinutes * convertDimensions(Unit.Time.Minute, Unit.Time.Millis)
    );
    return () => clearInterval(id);
  }, []);
  return version;
}
