import StorageNode, { nodes } from "../storage/storageNode";

export function downloadData() {
  const nodeObjects = nodes.map((n: StorageNode) => n.export());
  console.log(nodeObjects);
  const dataStr = JSON.stringify(nodeObjects, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const now = new Date();
  link.href = url;
  link.download = `SynthIQ Data ${now.toDateString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
export async function importData(file: File) {
  const text = await file.text();
  const nodeObjects = JSON.parse(text);
  nodeObjects.map((o: any) => {
    nodes.forEach((n: StorageNode) => n.import(o));
  });
}
