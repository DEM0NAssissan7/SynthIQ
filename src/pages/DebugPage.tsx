import { Button } from "react-bootstrap";
import Card from "../components/Card";
import StorageBackends from "../registries/storageBackends";
import { BackendStore } from "../storage/backendStore";

export default function DebugPage() {
  const storageBackend = StorageBackends.getDefault();
  const [queue, setQueue] = BackendStore.queue.useState();

  function clearQueue() {
    if (confirm(`Are you sure you want to clear the remote request queue?`)) {
      setQueue([]);
    }
  }
  return (
    <>
      <h1>Debug</h1>
      <Card>
        <h3>Storage Backend</h3>
        Storage size: {(storageBackend.size / 1024).toFixed(1)} KB
      </Card>
      <Card>
        <h3>Remote Queue</h3>
        <Button variant={"outline-danger"} onClick={clearQueue}>
          Clear Queue
        </Button>
        <table>
          <thead>
            <tr>
              <th>API</th>
              <th>Payload Size</th>
              <th>Type</th>
              <th>UUID</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.uuid}>
                <td>{q.api}</td>
                <td>{q.payload?.length ?? 0}</td>
                <td>{q.type}</td>
                <td>{q.uuid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
