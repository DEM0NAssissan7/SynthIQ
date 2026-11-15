import { registerSW } from "virtual:pwa-register";
import { VERSION_STRING } from "../version";
import { reloadApp, reloadWhenHidden } from "./reloadLog";

let registrationRef: ServiceWorkerRegistration | undefined;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;
let isReloading = false;

function showUpdateToast(message: string, duration = 3000) {
  if (typeof document === "undefined") return;
  let toast = document.getElementById("pwa-update-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pwa-update-toast";
    toast.className = "pwa-update-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  const existingTimer = (toast as unknown as { _timeout?: number })._timeout;
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  (toast as unknown as { _timeout?: number })._timeout = window.setTimeout(
    () => {
      toast?.classList.remove("show");
    },
    duration,
  );
}

export function initPwaUpdater() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // A new service worker taking over means a new app version is cached. The
  // running page keeps working, so the reload that picks the version up waits
  // until the app is in the background instead of blanking the screen in use.
  // The very first install also fires controllerchange (clientsClaim), but
  // the page is already current then.
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !isReloading) {
      isReloading = true;
      reloadWhenHidden("service worker controller changed (app update)");
    }
  });

  updateSWFn = registerSW({
    immediate: true,
    // Without this the plugin reloads the page itself on activation.
    onNeedReload() {
      isReloading = true;
      reloadWhenHidden("service worker activated (app update)");
    },
    onNeedRefresh() {
      // New service worker installed and waiting; tell it to activate
      if (updateSWFn) {
        updateSWFn(true);
      }
    },
    onOfflineReady() {
      console.log("SynthIQ is ready for offline use");
    },
    onRegisteredSW(_swUrl, r) {
      registrationRef = r;
      if (r) {
        // When PWA comes to foreground on iOS/mobile, check for update
        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            r.update().catch((err) =>
              console.warn("PWA update check failed:", err),
            );
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Also check periodically every 15 minutes
        setInterval(
          () => {
            r.update().catch((err) =>
              console.warn("PWA periodic update check failed:", err),
            );
          },
          15 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.warn("PWA registration failed:", error);
    },
  });
}

export async function checkPwaUpdate() {
  if (typeof window === "undefined") return;

  if (!("serviceWorker" in navigator)) {
    showUpdateToast("Service workers not supported on this browser.");
    reloadApp("manual update check #1");
    return;
  }

  showUpdateToast("Checking for updates...");

  try {
    const reg =
      registrationRef || (await navigator.serviceWorker.getRegistration());

    if (!reg) {
      showUpdateToast("No PWA registration found. Reloading...");
      setTimeout(() => reloadApp("manual update check #2"), 500);
      return;
    }

    // 1. If an updated worker is already waiting, trigger skipWaiting and reload
    if (reg.waiting) {
      showUpdateToast("Updating SynthIQ... Reloading...");
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      if (updateSWFn) {
        await updateSWFn(true);
      } else {
        setTimeout(() => reloadApp("manual update check #3"), 400);
      }
      return;
    }

    // 2. If an updated worker is currently installing, track its activation
    if (reg.installing) {
      showUpdateToast("Downloading update...");
      const worker = reg.installing;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" || worker.state === "activated") {
          showUpdateToast("Update installed! Reloading...");
          worker.postMessage({ type: "SKIP_WAITING" });
          setTimeout(() => reloadApp("manual update check #4"), 400);
        }
      });
      return;
    }

    // 3. Listen for updatefound during reg.update()
    let updateFound = false;
    const onUpdateFound = () => {
      updateFound = true;
      const worker = reg.installing;
      if (worker) {
        showUpdateToast("Downloading new version...");
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" || worker.state === "activated") {
            showUpdateToast("Update ready! Reloading...");
            worker.postMessage({ type: "SKIP_WAITING" });
            setTimeout(() => reloadApp("manual update check #5"), 400);
          }
        });
      }
    };
    reg.addEventListener("updatefound", onUpdateFound, { once: true });

    // Query browser network check
    await reg.update();

    // Give a brief window (700ms) for updatefound or worker state change to fire
    await new Promise((resolve) => setTimeout(resolve, 700));

    if (updateFound || reg.installing || reg.waiting) {
      return;
    }

    // 4. Fallback check: fetch root with cache-busting to verify if server deployed new assets
    try {
      const response = await fetch(`/?_cb=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (response.ok) {
        const text = await response.text();
        const currentScripts = Array.from(
          document.querySelectorAll("script[src]"),
        )
          .map((s) => (s as HTMLScriptElement).src)
          .filter((s) => s.includes("/assets/"));

        let hasNewScript = false;
        for (const scriptUrl of currentScripts) {
          const path = new URL(scriptUrl, window.location.href).pathname;
          if (!text.includes(path)) {
            hasNewScript = true;
            break;
          }
        }

        if (hasNewScript) {
          showUpdateToast("New version detected! Reloading...");
          if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          await reg.update().catch(() => {});
          setTimeout(() => reloadApp("manual update check #6"), 400);
          return;
        }
      }
    } catch {
      // Network fetch fallback failed, proceed with up-to-date toast
    }

    showUpdateToast(`SynthIQ is up to date (${VERSION_STRING})`);
  } catch (err) {
    console.warn("PWA check error:", err);
    showUpdateToast("Checking failed. Reloading...");
    setTimeout(() => reloadApp("manual update check #7"), 600);
  }
}
