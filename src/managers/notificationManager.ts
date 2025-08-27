import { convertDimensions } from "../lib/util";
import Unit from "../models/unit";

export namespace NotificationManager {
  export function create(title: string, body: string, delaySeconds?: number) {
    if (window.Notification) {
      Notification.requestPermission(function (status) {
        console.log("Status: ", status);
        const notifier = () => new Notification(title, { body: body });
        setTimeout(
          notifier,
          (delaySeconds ?? 0) *
            convertDimensions(Unit.Time.Second, Unit.Time.Millis)
        );
      });
    } else {
      alert("Your browser doesn't support notifications.");
    }
  }
}
