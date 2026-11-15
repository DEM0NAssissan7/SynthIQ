import { Button } from "react-bootstrap";
import Card from "../components/Card";
import StorageBackends from "../registries/storageBackends";
import { BackendStore } from "../storage/backendStore";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";
import { useState } from "react";
import { clearReloadLog, getReloadLog } from "../lib/reloadLog";

export default function DebugPage() {
  const storageBackend = StorageBackends.getDefault();
  const [queue, setQueue] = BackendStore.queue.useState();

  const [reloadLog, setReloadLog] = useState(getReloadLog);

  function clearQueue() {
    if (confirm(`Are you sure you want to clear the remote request queue?`)) {
      setQueue([]);
    }
  }
  return (
    <PageLayout maxWidth="42rem">
      <PageHeader
        eyebrow="Utility"
        title="Debug"
        subtitle="Inspect storage size and queued backend requests without digging into raw logs."
      />
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Storage backend
        </div>
        Storage size: {(storageBackend.size / 1024).toFixed(1)} KB
      </Card>
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Remote queue
        </div>
        <Button variant={"outline-danger"} onClick={clearQueue}>
          Clear Queue
        </Button>
        {queue.length === 0 ? (
          <div className="mt-3">
            <EmptyState>No queued backend requests.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 d-grid gap-2">
            {queue.map((q) => (
              <div key={q.uuid} className="rounded-4 app-metric-pill p-3">
                <div className="fw-semibold">{q.api}</div>
                <div className="small text-muted">Type: {q.type}</div>
                <div className="small text-muted">
                  Payload size: {q.payload?.length ?? 0}
                </div>
                <div className="small text-muted text-break">
                  UUID: {q.uuid}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Page loads and reloads
        </div>
        <Button
          variant={"outline-secondary"}
          onClick={() => {
            clearReloadLog();
            setReloadLog([]);
          }}
        >
          Clear log
        </Button>
        {reloadLog.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Nothing recorded yet.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 small font-monospace">
            {reloadLog
              .slice()
              .reverse()
              .map((e, i) => (
                <div key={i} className="text-break">
                  <span className="text-muted">
                    {new Date(e.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    .{String(e.time % 1000).padStart(3, "0")}
                  </span>{" "}
                  {e.event}
                </div>
              ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
