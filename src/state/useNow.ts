import { useState, useEffect } from "react";

export function useNow(updateRate = 10) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateRate * 1000);
    return () => clearInterval(interval);
  }, [updateRate]);
  return now;
}
