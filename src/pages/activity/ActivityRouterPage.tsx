import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";
import { useEffect } from "react";

export default function ActivityRouterPage() {
  const navigate = useNavigate();
  useEffect(() => {
    ActivityManager.navigateToCurrentPage(navigate);
  });
  return <></>;
}
