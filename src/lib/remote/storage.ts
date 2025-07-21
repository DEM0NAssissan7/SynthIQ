import { backendStore } from "../../storage/backendStore";
import privateStore from "../../storage/privateStore";
import StorageNode from "../storageNode";
import { nodes } from "../storageNode";
import { genUUID } from "../util";
import Backend from "./backend";

class RemoteStorage {
  private static async getProfiles() {
    return await Backend.get("profile");
  }
  private static async getProfile() {
    return (await this.getProfiles())[backendStore.get("profileID")];
  }
  private static async putProfile(p: any) {
    Backend.put("profile", p);
  }
  static async upload() {
    let nodeObjects = [];
    nodeObjects = nodes.map((n: StorageNode) => n.export());
    let profile = await this.getProfile();
    profile.nodeObjects = nodeObjects;

    const uuid = genUUID();
    profile.nodeUUID = uuid;
    privateStore.set("syncUUID", uuid);

    this.putProfile(profile);
  }
  static async download() {
    const profile = await this.getProfile();
    if (profile.nodeUUID !== privateStore.get("syncUUID")) {
      profile.nodeObjects.map((o: any) => {
        nodes.forEach((n: StorageNode) => n.import(o));
      });
      privateStore.set("syncUUID", profile.nodeUUID);
      return true;
    }
    return false;
  }

  // Slave-master dynamic
  private static get isMaster(): boolean | null {
    return privateStore.get("isMaster");
  }
  static async sync() {
    switch (this.isMaster) {
      case null:
        // If sync is disabled
        return;
      case true:
        // If it is master
        console.log(`Synchronizing storage to backend.`);
        await this.upload();
        break;
      case false:
        // If it is slave
        const synced = await this.download();
        if (synced) {
          console.log(`Storage synchronized from backend. Reloading...`);
          this.setMaster(false); // Set master to false because it gets overridden in sync
          location.reload(); // Reload page upon sync to ensure state consistency
        }
        break;
    }
  }
  static setMaster(state: boolean | null) {
    privateStore.set("isMaster", state);
  }
}

export default RemoteStorage;
