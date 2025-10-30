import { useState, useEffect } from "react";

export function useNow(updateSeconds = 10) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateSeconds * 1000);
    return () => clearInterval(interval);
  }, [updateSeconds]);
  return now;
}
