import StorageNode from "./storageNode";

export namespace MigrationStore {
  const node = new StorageNode("migration");

  export const namedMeals = node.add("namedMeals", false);
  export const migratedSessionsToStream = node.add(
    "migratedSessionsToStream",
    false,
  );
}
