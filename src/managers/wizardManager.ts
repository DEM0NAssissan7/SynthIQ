import Session from "../models/session";
import Meal from "../models/events/meal";
import RemoteTreatments from "../lib/remote/treatments";
import RemoteSessions from "../lib/remote/sessions";
import { WizardStore } from "../storage/wizardStore";
import MealTemplate from "../models/mealTemplate";
import type Activity from "../models/events/activity";
import { InsulinVariantManager } from "./insulinVariantManager";
import type { RescueVariant } from "../models/types/rescueVariant";
import { PrivateStore } from "../storage/privateStore";
import type Insulin from "../models/events/insulin";
import { getFastingVelocity, getDailyBasal, addNewBasal } from "../lib/basal";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { ActivityManager } from "./activityManager";
import { addRecentBolus, setLastRescue } from "../lib/healthMonitor";

export default class WizardManager {
  // This manager deals with the session automation
  static shouldTransitionSession(): boolean {
    const session = WizardStore.session.value;
    if (!session.started) return false;
    return session.readyToTransition;
  }
  static transition(BG: number): Session {
    const oldSession = WizardStore.session.value;
    const newSession = new Session();
    newSession.initialGlucose = BG;
    newSession.fastingVelocity = getFastingVelocity();
    newSession.dailyBasal = getDailyBasal();
    newSession.onBoardInsulins = HealthMonitorStore.recentBoluses.value;

    // Finalize and archive previous session if one was running
    if (oldSession.started && !oldSession.completed) {
      oldSession.finalBG = BG;
      oldSession.snapshot.pullReadings();
      if (oldSession.immature) {
        oldSession.isGarbage = true;
        newSession.isGarbage = true;
      }
      this.addSessionToActiveTemplate(oldSession);
      this.replaceTemplateToArray();
      RemoteSessions.storeSession(oldSession);
    }

    // Update store references
    WizardStore.session.value = newSession;
    WizardStore.activeTemplate.value = WizardStore.template.value;

    return newSession;
  }

  // Glucose marking
  static setInitialGlucose(
    BG: number,
    fastingVelocity: number,
    dailyBasal: number,
    onBoardInsulins: Insulin[],
  ) {
    const session = WizardStore.session.value;
    if (!session.initialGlucose) {
      session.fastingVelocity = fastingVelocity;
      session.initialGlucose = BG;
      session.dailyBasal = dailyBasal;
      session.onBoardInsulins = onBoardInsulins;
    }
  }

  // Meal
  static markMeal(BG: number, timestamp = new Date()) {
    if (this.shouldTransitionSession()) {
      this.transition(BG);
    } else if (!WizardStore.session.value.initialGlucose && BG) {
      // If starting fresh without pre-bolus
      this.setInitialGlucose(
        BG,
        getFastingVelocity(),
        getDailyBasal(),
        HealthMonitorStore.recentBoluses.value,
      );
    }

    const meal: Meal = WizardStore.meal.value;
    const session: Session = WizardStore.session.value;

    meal.timestamp = timestamp;
    session.addMeal(meal);
    this.resetMeal(); // Now that the meal is officially part of the session, reset the scratchpad meal

    RemoteTreatments.markMeal(meal.carbs, meal.protein, timestamp);
    WizardStore.session.write();
  }

  // Insulin
  private static insulin(
    units: number,
    BG: number,
    variantName: string,
    mealRelated: boolean,
  ) {
    const session: Session = WizardStore.session.value;
    const timestamp = new Date();
    const variant =
      InsulinVariantManager.getVariant(variantName) ??
      InsulinVariantManager.getDefault();

    // Avoid adding insulin to session that does not want it
    if (mealRelated || session.started) {
      session.createInsulin(units, timestamp, variant, BG);
      WizardStore.session.write();
    }

    // Add it to the other places
    RemoteTreatments.markInsulin(units, timestamp, variantName);
    addRecentBolus(units, variant, timestamp);
  }
  static markInsulin(
    units: number,
    BG: number,
    variantName: string,
    mealRelated: boolean,
  ) {
    // If it's not meal related, call it a day and just mark it on the session
    if (!mealRelated) {
      this.insulin(units, BG, variantName, mealRelated);
      return;
    }

    // If it's meal related, we first need to figure out if we need to make a new session
    if (this.shouldTransitionSession()) {
      this.transition(BG);
    } else if (!WizardStore.session.value.initialGlucose) {
      // If this bolus is starting a new session (e.g. pre-bolusing before planning food)
      this.setInitialGlucose(
        BG,
        getFastingVelocity(),
        getDailyBasal(),
        HealthMonitorStore.recentBoluses.value,
      );
    }

    // Now we mark insulin
    this.insulin(units, BG, variantName, mealRelated);
  }

  // Basal
  static markBasal(amount: number, timestamp = new Date()) {
    addNewBasal(amount, timestamp);
    RemoteTreatments.markBasal(amount, timestamp);
  }

  // Glucose
  static markGlucose(amount: number, variant: RescueVariant) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    const session: Session = WizardStore.session.value;
    const timestamp = new Date();
    if (session.started) {
      session.createGlucose(amount, timestamp, variant);
      WizardStore.session.write();
    }
    ActivityManager.markGlucose(amount, variant);
    RemoteTreatments.markGlucose(
      amount * variant.carbs,
      timestamp,
      variant.name,
    );
    setLastRescue(amount, variant, timestamp);
  }

  // Activity
  static markActivity(activity: Activity) {
    RemoteTreatments.markActivity(
      activity.name,
      activity.timestamp,
      activity.length,
    );
    const session = WizardStore.session.value;
    session.addActivity(activity);
    WizardStore.session.write();
  }

  // Template selection
  private static getTemplateIndexByName(name: string): number {
    const templates = WizardStore.templates.value;
    for (let i = 0; i < templates.length; i++) {
      if (templates[i].name === name) return i;
    }
    throw new Error(`Cannot find template named ${name}`);
  }
  private static getTemplateByName(name: string): MealTemplate {
    const templates = WizardStore.templates.value;
    return templates[this.getTemplateIndexByName(name)];
  }
  private static replaceTemplateToArray() {
    const activeTemplate = WizardStore.activeTemplate.value;
    if (!activeTemplate || !activeTemplate.name) return;
    try {
      const index = this.getTemplateIndexByName(activeTemplate.name);
      WizardStore.templates.value[index] = activeTemplate;
      WizardStore.templates.write();
    } catch {
      // Template not in array
    }
  }

  // Template functions
  static addSessionToActiveTemplate(session: Session) {
    const activeTemplate = WizardStore.activeTemplate.value;
    if (!activeTemplate || !activeTemplate.name) return;
    activeTemplate.addSession(session);
    WizardStore.activeTemplate.write();
  }

  static selectSession(session: Session) {
    if (!session.meal) return;
    WizardStore.meal.value = Meal.deserialize(Meal.serialize(session.meal));
  }
  static selectTemplate(name: string) {
    // Select template to be used for all operations
    const template = this.getTemplateByName(name);
    WizardStore.template.value = template;
    if (!WizardStore.session.value.mealMarked)
      WizardStore.activeTemplate.value = template; // Workaround for transition
    WizardStore.meal.value = new Meal(new Date(), template.UUID); // Populate meal with an empty entry
    if (PrivateStore.debugLogs.value) console.log(template);
    return template;
  }
  static createTemplate(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Template name cannot be empty");
    }
    // Check if template already exists — if so, just select it
    try {
      const existing = this.getTemplateByName(trimmedName);
      this.selectTemplate(trimmedName);
      return existing;
    } catch {
      // Template doesn't exist, create it
      const template = new MealTemplate(trimmedName);
      WizardStore.templates.value.push(template);
      WizardStore.templates.write();
      this.selectTemplate(trimmedName);
      return template;
    }
  }
  static deleteTemplate(name: string) {
    const templates = WizardStore.templates.value;
    const index = templates.findIndex((t) => t.name === name);
    if (index === -1) {
      throw new Error(`Cannot delete template named ${name}: not found`);
    }
    templates.splice(index, 1);
    WizardStore.templates.write();
  }
  /**
   * Updates the session with `name` to use ALL sessions
   * @param name Name of template
   */
  static setGlobMeta(name: string) {
    const template = this.getTemplateByName(name);
    const templateSessionUUIDs = template.sessions.map((s) => s.uuid);
    const allSessions = this.getAllSessions().map((s) =>
      Session.deserialize(Session.serialize(s)),
    );
    template.auxillarySessions = allSessions.filter(
      (s) => templateSessionUUIDs.indexOf(s.uuid) === -1,
    );
    // Note: auxillarySessions is not serialized
  }

  // Reset
  static endSession(finalBG: number) {
    const session = WizardStore.session.value;
    session.finalBG = finalBG;
    session.snapshot.pullReadings();
  }
  static resetTemplate() {
    this.addSessionToActiveTemplate(WizardStore.session.value);
    this.replaceTemplateToArray();
    WizardStore.template.value = new MealTemplate("");
  }
  static resetSession() {
    WizardStore.session.value = new Session();
  }
  static resetMeal() {
    WizardStore.meal.value = new Meal(new Date());
  }
  static resetWizard() {
    this.resetSession(); // Reset the session
    this.resetMeal(); // Reset temporary meal
  }
  static cancelSession() {
    if (
      confirm(
        "Are you sure you want to discard the entire session? This will delete all data you've inputted so far for this session.",
      )
    ) {
      this.resetWizard();
    }
  }

  // General helper functions
  static getAllSessions() {
    const templates = WizardStore.templates.value;
    let sessions: Session[] = [];
    templates.forEach((t) => t.sessions.forEach((s) => sessions.push(s)));
    return sessions;
  }
}
