import { Button } from "react-bootstrap";
import Card from "../components/Card";
import StorageBackends from "../registries/storageBackends";
import { BackendStore } from "../storage/backendStore";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";

export default function DebugPage() {
  const storageBackend = StorageBackends.getDefault();
  const [queue, setQueue] = BackendStore.queue.useState();

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
              <div key={q.uuid} className="rounded-4 border p-3 bg-light-subtle">
                <div className="fw-semibold">{q.api}</div>
                <div className="small text-muted">Type: {q.type}</div>
                <div className="small text-muted">
                  Payload size: {q.payload?.length ?? 0}
                </div>
                <div className="small text-muted text-break">UUID: {q.uuid}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
