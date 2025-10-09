import { useState, useEffect } from "react";

export function useNow(updateRate = 10000) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateRate);
    return () => clearInterval(interval);
  }, [updateRate]);
  return now;
}
