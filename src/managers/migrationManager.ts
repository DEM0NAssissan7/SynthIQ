import { MigrationStore } from "../storage/migrationStore";
import { StreamStore } from "../storage/streamStore";
import { WizardStore } from "../storage/wizardStore";
import { StreamManager } from "./streamManager";
import WizardManager from "./wizardManager";

export namespace MigrationManager {
  function addInfoToMeals() {
    WizardStore.templates.write();
    MigrationStore.namedMeals.value = true;
  }
  function migrateSessionsToStream() {
    const templates = WizardStore.templates.value;
    const sessions: Session[] = [];
    for (const template of templates) {
      template.sessions.forEach((s) => {
        sessions.push(s);
        if (!s.meal) return;
        s.meal.name = template.name;
        s.meal.isGarbage = s.isGarbage;
        s.meal.templateUUID = template.UUID;
      });
    }
    sessions.forEach((s) => StreamManager.storeSession(s, false));
    MigrationStore.migratedSessionsToStream.value = true;
    StreamStore.stream.write();

    // Now we clear the old data
  }
  export function migrate() {
    if (!MigrationStore.namedMeals.value) addInfoToMeals();
    if (!MigrationStore.migratedSessionsToStream.value)
      migrateSessionsToStream();
  }
}
