/* Wizard Router */

import { useNavigate } from "react-router";
import { useEffect } from "react";
import WizardManager from "../../lib/wizardManager";

function WizardRouterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    WizardManager.moveToCurrentPage(navigate);
  });
  return <></>;
}

export default WizardRouterPage;
