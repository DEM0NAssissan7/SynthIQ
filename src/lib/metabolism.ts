import StorageNode from "./storageNode";

export const metaProfile = new StorageNode("profile");

// Glucose Shot Characteristics
metaProfile.add("pglucose", 6.45);
metaProfile.add("nglucose", 0);
metaProfile.add("mlsPerCap", 5);
metaProfile.add("gramsPerMl", 1 / 3);

// Inuslin Pharmacodynamics
metaProfile.add("einsulin", 28); // Insulin point effect / unit
metaProfile.add("pinsulin", 0.028); // insulin half-life in blood
metaProfile.add("ninsulin", 0.5); // hrs delay before insulin starts working

// Carbohydrate Metabolism
metaProfile.add("ecarbs", 4.11); // Rise per gram of carbs
metaProfile.add("ncarbs", 0.0);
metaProfile.add("pcarbs", 1.61);

// Protein Gluconeogenesis Metabolism
metaProfile.add("eprotein", 1.19); // Rise per gram of protein
metaProfile.add("nprotein", 0.0);
// Metabolism Characteristics
metaProfile.add("rprotein", 3.6); // Rise time
metaProfile.add("pprotein", 0.0351); // Plateau Time Rate (hours / gram)
metaProfile.add("fprotein", 1.83); // Fall time
