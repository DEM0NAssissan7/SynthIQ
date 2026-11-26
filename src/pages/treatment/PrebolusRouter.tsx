import { useNavigate } from "react-router";
import { useEffect } from "react";
import { EntryStore } from "../../storage/entryStore";
import { InjectionPurpose } from "../../models/events/insulin";

export default function () {
  const navigate = useNavigate();
  EntryStore.injectionPurpose.value = InjectionPurpose.PreBolus;
  useEffect(() => {
    navigate("/insulin");
  }, [navigate]);
  return <></>;
}
