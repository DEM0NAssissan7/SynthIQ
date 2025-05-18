import StorageNode from "./storageNode";

export const profile = new StorageNode("profile");

// Glucose Shot Characteristics
profile.add("pglucose", 6.45);
profile.add("nglucose", 0);
profile.add("mlsPerCap", 5);
profile.add("gramsPerMl", 1 / 3);

// Inuslin Pharmacodynamics
profile.add("einsulin", 28); // Insulin point effect / unit
profile.add("pinsulin", 0.028); // insulin half-life in blood
profile.add("ninsulin", 0.5); // hrs delay before insulin starts working

// Carbohydrate Metabolism
profile.add("ecarbs", 4.11); // Rise per gram of carbs
profile.add("ncarbs", 0.0);
profile.add("pcarbs", 1.61);

// Protein Gluconeogenesis Metabolism
profile.add("eprotein", 1.19); // Rise per gram of protein
profile.add("nprotein", 0.0);
// Metabolism Characteristics
profile.add("rprotein", 3.6); // Rise time
profile.add("pprotein", 0.0351); // Plateau Time Rate (hours / gram)
profile.add("fprotein", 1.83); // Fall time
