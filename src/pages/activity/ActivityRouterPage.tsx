import { useNavigate } from "react-router";
import { ActivityManager } from "../../managers/activityManager";

export default function ActivityRouterPage() {
  const navigate = useNavigate();
  ActivityManager.navigateToCurrentPage(navigate);
  return <></>;
}
