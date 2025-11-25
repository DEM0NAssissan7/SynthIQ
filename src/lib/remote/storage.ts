import { MasterState } from "../../models/types/masterState";
import { PrivateStore } from "../../storage/privateStore";
import StorageNode from "../../storage/storageNode";
import { nodes } from "../../storage/storageNode";
import { genUUID } from "../util";
import { RemoteProfile } from "./profile";

class RemoteStorage {
  static async upload() {
    let nodeObjects = [];
    nodeObjects = nodes.map((n: StorageNode) => n.export());
    let profile = await RemoteProfile.getProfile();
    profile.nodeObjects = nodeObjects;

    const uuid = genUUID();
    profile.nodeUUID = uuid;
    PrivateStore.syncUUID.value = uuid;

    RemoteProfile.putProfile(profile);
  }
  static async download(forced = false) {
    const profile = await RemoteProfile.getProfile();
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
    switch (PrivateStore.masterState.value) {
      case MasterState.NONE:
        // If sync is disabled
        return;
      case MasterState.MASTER:
        // If it is master
        console.log(`Synchronizing storage to backend.`);
        await this.upload();
        break;
      case MasterState.SLAVE:
      case MasterState.TERMINAL:
        // If it is slave
        const synced = await this.download();
        if (synced) {
          console.log(`Storage synchronized from backend. Reloading...`);
          location.reload(); // Reload page upon sync to ensure state consistency
        }
        return true;
    }
  }
}

export default RemoteStorage;
