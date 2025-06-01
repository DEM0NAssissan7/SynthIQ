import StorageNode from "../lib/storageNode";
import MetabolismProfile from "../models/metabolism/metabolismProfile";

const metaProfile = new StorageNode("profile");

metaProfile.add(
  "profile",
  new MetabolismProfile(),
  MetabolismProfile.parse,
  MetabolismProfile.stringify
);
export let profile = metaProfile.get("profile") as MetabolismProfile;
const profileStorageWriteHandler = () => metaProfile.write("profile");
export function changeProfile(p: MetabolismProfile) {
  profile.unsubscribe(profileStorageWriteHandler);
  profile = p;
  profile.subscribe(profileStorageWriteHandler); // Automatically save the profile when it changes
}

changeProfile(profile);