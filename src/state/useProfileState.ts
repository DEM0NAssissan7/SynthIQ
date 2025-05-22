import { useState, useEffect } from "react";
import { profile } from "../storage/metaProfileStore";

export default function useProfileState() {
  const [, setVersion] = useState(0);

  const rerender = () => setVersion((v) => v + 1); // force re-render
  useEffect(() => {
    profile.subscribe(rerender);
    return () => profile.unsubscribe(rerender);
  }, []);

  return profile;
}
