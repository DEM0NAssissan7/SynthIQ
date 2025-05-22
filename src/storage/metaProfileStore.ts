import StorageNode from "../lib/storageNode";
import MetabolismProfile from "../models/metabolism/metabolismProfile";

const metaProfile = new StorageNode("profile");
export default metaProfile;

metaProfile.add(
  "profile",
  new MetabolismProfile(),
  MetabolismProfile.parse,
  MetabolismProfile.stringify
);
export const profile = metaProfile.get("profile") as MetabolismProfile;
profile.subscribe(() => metaProfile.write("profile")); // Automatically save the profile when it changes

// General User Prefs
metaProfile.add("target", 83);
metaProfile.add("minThreshold", 75);

// Inuslin Pharmacodynamics
metaProfile.add("einsulin", 19); // Insulin point effect / unit
metaProfile.add("pinsulin", 2.5); // insulin half-life in blood
metaProfile.add("ninsulin", 0.5); // hrs delay before insulin starts working

// Carbohydrate Metabolism
metaProfile.add("ecarbs", 4.11); // Rise per gram of carbs
metaProfile.add("ncarbs", 0.0);
metaProfile.add("pcarbs", 1.17);

// Protein Gluconeogenesis Metabolism
metaProfile.add("eprotein", 1.14); // Rise per gram of protein
metaProfile.add("nprotein", 2.0);
// Metabolism Characteristics
metaProfile.add("cprotein", 2); // Minimum digestion duration
metaProfile.add("pprotein", 0.205); // Plateau Time Rate (hours / gram)

// Glucose Shot Characteristics
metaProfile.add("pglucose", 6.45);
metaProfile.add("nglucose", 0);
metaProfile.add("mlsPerCap", 5);
metaProfile.add("gramsPerMl", 1 / 3);
