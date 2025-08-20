import { BackendStore } from "../../storage/backendStore";
import { PrivateStore } from "../../storage/privateStore";
import StorageNode from "../../storage/storageNode";
import { nodes } from "../../storage/storageNode";
import { genUUID } from "../util";
import Backend from "./backend";

class RemoteStorage {
  private static async getProfiles() {
    return await Backend.get("profile");
  }
  private static async getProfile() {
    return (await this.getProfiles())[BackendStore.profileID.value];
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
    PrivateStore.syncUUID.value = uuid;

    this.putProfile(profile);
  }
  static async download(forced = false) {
    const profile = await this.getProfile();
    if (profile.nodeUUID !== PrivateStore.syncUUID.value || forced) {
      profile.nodeObjects.map((o: any) => {
        nodes.forEach((n: StorageNode) => n.import(o));
      });
      PrivateStore.syncUUID.value = profile.nodeUUID;
      return true;
    }
    return false;
  }

  // Slave-master dynamic
  static async sync() {
    switch (PrivateStore.isMaster.value) {
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
          PrivateStore.isMaster.value = false;
          location.reload(); // Reload page upon sync to ensure state consistency
        }
        break;
    }
  }
}

export default RemoteStorage;
