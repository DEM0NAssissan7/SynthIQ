import { BackendStore } from "../../storage/backendStore";
import Backend from "./backend";

export namespace RemoteProfile {
  export async function getProfiles() {
    return await Backend.get("profile");
  }
  export async function getProfile() {
    return (await getProfiles())[BackendStore.profileID.value];
  }
  export async function putProfile(p: any) {
    Backend.put("profile", p);
  }
}
