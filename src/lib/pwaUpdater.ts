import { registerSW } from "virtual:pwa-register";

let registrationRef: ServiceWorkerRegistration | undefined;

export function initPwaUpdater() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      registrationRef = r;
      if (r) {
        // When PWA comes to foreground on iOS/mobile, check for update
        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            r.update().catch((err) =>
              console.warn("PWA update check failed:", err)
            );
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Also check periodically every 15 minutes
        setInterval(() => {
          r.update().catch((err) =>
            console.warn("PWA periodic update check failed:", err)
          );
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn("PWA registration failed:", error);
    },
  });
}

export function checkPwaUpdate() {
  if (registrationRef) {
    registrationRef
      .update()
      .then(() => {
        console.log("Checked for PWA update");
      })
      .catch((err) => {
        console.warn("PWA check error, reloading:", err);
        window.location.reload();
      });
  } else if (typeof window !== "undefined") {
    window.location.reload();
  }
}
