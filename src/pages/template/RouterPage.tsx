/* Wizard Router */

import { useNavigate } from "react-router";
import { useEffect } from "react";
import TemplateManager from "../../lib/templateManager";

function RouterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    TemplateManager.moveToCurrentPage(navigate);
  });
  return <></>;
}

export default RouterPage;
