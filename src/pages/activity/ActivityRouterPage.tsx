import { useNavigate } from "react-router";
import { useEffect } from "react";
import { EntryStore } from "../../storage/entryStore";

export default function ActivityRouterPage() {
  const navigate = useNavigate();
  useEffect(() => {
    if (EntryStore.activityIsActive.value) navigate("/activity/end");
    else navigate("/activity/select");
  });
  return <></>;
}
