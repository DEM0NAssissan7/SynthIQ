import { useNavigate } from "react-router";
import { WizardStore } from "../../storage/wizardStore";
import { useEffect } from "react";

export default function () {
  const navigate = useNavigate();
  useEffect(() => {
    WizardStore.isBolus.value = true;
    navigate("/insulin");
  });
  return <></>;
}
