import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import type { ActivityTemplate } from "../models/activityTemplate";
import type Activity from "../models/events/activity";
import { useNow } from "../state/useNow";

interface ActivitySummaryProps {
  activity: Activity;
  template: ActivityTemplate;
}
export default function ActivitySummary({
  activity,
  template,
}: ActivitySummaryProps) {
  const now = useNow();
  return (
    <>
      <h2 style={{ paddingTop: "12px" }}>{template.name}</h2>
      {template.isFirstTime && (
        <>
          This is the first time using this template
          <br />
        </>
      )}
      {activity.started && (
        <>
          This activity was started at{" "}
          <b>{getPrettyTime(activity.timestamp)}</b>,{" "}
          <b>{getFormattedTime(getMinuteDiff(now, activity.timestamp))} ago</b>
        </>
      )}
    </>
  );
}
