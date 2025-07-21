import { backendStore } from "../../storage/backendStore";
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
    backendStore.set("syncUUID", uuid);

    this.putProfile(profile);
  }
  static async download() {
    const profile = await this.getProfile();
    if (profile.nodeUUID !== backendStore.get("syncUUID")) {
      profile.nodeObjects.map((o: any) => {
        nodes.forEach((n: StorageNode) => n.import(o));
      });
      backendStore.set("syncUUID", profile.nodeUUID);
      return true;
    }
    return false;
  }
  }
}

export default RemoteStorage;
