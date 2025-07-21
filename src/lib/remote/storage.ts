import { nightscoutStore } from "../../storage/nightscoutStore";
import StorageNode from "../storageNode";
import { nodes } from "../storageNode";
import Backend from "./backend";

class RemoteStorage {
  private static async getProfiles() {
    return await Backend.get("profile");
  }
  private static async getProfile() {
    return await this.getProfiles().then(
      (a) => a[nightscoutStore.get("profileID")]
    );
  }
  private static async putProfile(p: any) {
    Backend.put("profile", p);
  }
  static async upload() {
    let nodeObjects = [];
    nodeObjects = nodes.map((n: StorageNode) => n.export());
    let profile = await this.getProfile();
    profile.nodeObjects = nodeObjects;
    this.putProfile(profile);
  }
  static async download() {
    let nodeObjects = (await this.getProfile()).nodeObjects;
    nodeObjects.map((o: any) => {
      nodes.forEach((n: StorageNode) => n.import(o));
    });
  }
}

export default RemoteStorage;
