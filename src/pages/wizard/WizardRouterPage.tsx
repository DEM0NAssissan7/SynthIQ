/* Wizard Router */

import { useNavigate } from "react-router";
import WizardManager from "../../lib/wizardManager";
import { useEffect } from "react";
import TemplateManager from "../../lib/templateManager";

function WizardRouterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (TemplateManager.isActive()) TemplateManager.moveToCurrentPage(navigate);
    else WizardManager.moveToCurrentPage(navigate);
  });
  return <></>;
}

export default WizardRouterPage;
