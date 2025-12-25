import Card from "../components/Card";
import StorageBackends from "../registries/storageBackends";

export default function DebugPage() {
  const storageBackend = StorageBackends.getDefault();

  return (
    <>
      <h1>Debug</h1>
      <Card>
        <h3>Storage Backend</h3>
        Storage size: {(storageBackend.size / 1024).toFixed(1)} KB
      </Card>
    </>
  );
}
