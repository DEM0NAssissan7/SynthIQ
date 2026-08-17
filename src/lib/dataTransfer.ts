import StorageNode, { nodes } from "../storage/storageNode";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export async function downloadData() {
  const nodeObjects = nodes.map((n: StorageNode) => n.export());
  console.log(nodeObjects);
  const dataStr = JSON.stringify(nodeObjects, null, 2);
  const now = new Date();
  const filename = `SynthIQ Data ${now.toDateString()}.json`;

  // Check if we're inside a React Native WebView
  if (typeof window !== "undefined" && window.ReactNativeWebView) {
    await downloadViaWebview(filename, dataStr);
  } else {
    downloadViaBrowser(filename, dataStr);
  }
}

async function downloadViaWebview(filename: string, dataStr: string) {
  const CHUNK_SIZE = 800_000;
  const totalChunks = Math.ceil(dataStr.length / CHUNK_SIZE);
  const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const webView = window.ReactNativeWebView!;

  return new Promise<void>((resolve, reject) => {
    let timeoutId: any;

    const listener = (event: any) => {
      try {
        let msgData = event.data;
        if (typeof msgData === "string") {
          try { msgData = JSON.parse(msgData); } catch { return; }
        }
        if (msgData && msgData.type === "DOWNLOAD_RESPONSE" && msgData.id === id) {
          clearTimeout(timeoutId);
          window.removeEventListener("message", listener);
          document.removeEventListener("message", listener);
          if (msgData.success) resolve();
          else reject(new Error(msgData.error || "Download failed"));
        }
      } catch (e) {}
    };

    window.addEventListener("message", listener);
    document.removeEventListener("message", listener);

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", listener);
      document.removeEventListener("message", listener);
      reject(new Error("Download request timeout"));
    }, 15000);

    // Send metadata first
    webView.postMessage(JSON.stringify({
      id,
      type: "DOWNLOAD_START",
      filename,
      totalChunks,
    }));

    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunk = dataStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      webView.postMessage(JSON.stringify({
        id,
        type: "DOWNLOAD_CHUNK",
        index: i,
        data: chunk,
      }));
    }

    // Signal end
    webView.postMessage(JSON.stringify({
      id,
      type: "DOWNLOAD_END",
    }));
  });
}

function downloadViaBrowser(filename: string, dataStr: string) {
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent("click"));
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 300);
}

export async function importData(file: File) {
  const text = await file.text();
  const nodeObjects = JSON.parse(text);
  nodeObjects.map((o: any) => {
    nodes.forEach((n: StorageNode) => n.import(o));
  });
}
