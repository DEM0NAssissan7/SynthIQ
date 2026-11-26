import { useNavigate } from "react-router";
import { useEffect } from "react";
import { WizardStore } from "../../storage/entryStore";

export default function () {
  const navigate = useNavigate();
  WizardStore.isPrebolus.value = true;
  useEffect(() => {
    navigate("/insulin");
  }, [navigate]);
  return <></>;
}
