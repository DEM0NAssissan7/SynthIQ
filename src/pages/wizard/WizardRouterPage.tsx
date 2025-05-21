/* Wizard Router */

import { useNavigate } from "react-router";
import WizardManager from "../../lib/wizardManager";
import { useEffect } from "react";

function WizardRouterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    WizardManager.moveToCurrentPage(navigate);
  });
  return <></>;
}

export default WizardRouterPage;
