import { useEffect, useState } from "react";

export default function useVersion(intervalMinutes: number) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const versionHandler = () => setVersion(version + 1);
    const id = setInterval(versionHandler);
    return () => clearInterval(id);
  }, []);
  return version;
}
