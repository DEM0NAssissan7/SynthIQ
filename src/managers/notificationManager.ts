import { convertDimensions } from "../lib/util";
import Unit from "../models/unit";
import { PrivateStore } from "../storage/privateStore";

export namespace NotificationManager {
  export function create(title: string, body: string, delaySeconds?: number) {
    if (window.Notification) {
      Notification.requestPermission(function (status) {
        if (PrivateStore.debugLogs.value) console.log("Status: ", status);
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
