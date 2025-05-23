import StorageNode from "../lib/storageNode";
import MetabolismProfile from "../models/metabolism/metabolismProfile";

const metaProfile = new StorageNode("profile");

metaProfile.add(
  "profile",
  new MetabolismProfile(),
  MetabolismProfile.parse,
  MetabolismProfile.stringify
);
export const profile = metaProfile.get("profile") as MetabolismProfile;
profile.subscribe(() => metaProfile.write("profile")); // Automatically save the profile when it changes
