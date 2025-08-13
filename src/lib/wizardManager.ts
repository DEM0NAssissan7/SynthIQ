import Session from "../models/session";
import Meal from "../models/events/meal";
import { serializeWizardPage, WizardPage } from "../models/types/wizardState";
import { type NavigateFunction } from "react-router";
import RemoteTreatments from "./remote/treatments";
import RemoteSessions from "./remote/sessions";
import { WizardStore } from "../storage/wizardStore";
import Template from "../models/template";

export default class WizardManager {
  // Page Redirects
  private static getPageRedirect(state: WizardPage): string {
    return `/wizard/${serializeWizardPage(state)}`;
  }

  // Movement
  static moveToPage(page: WizardPage, navigate: NavigateFunction): void {
    WizardStore.page.value = page;
    navigate(this.getPageRedirect(page));
  }
  static moveToCurrentPage(navigate: NavigateFunction): void {
    this.moveToPage(WizardStore.page.value, navigate);
  }
  static moveToFirstPage(navigate: NavigateFunction): void {
    this.moveToPage(WizardPage.Select, navigate);
  }
  static begin(navigate: NavigateFunction) {
    this.moveToPage(WizardPage.Meal, navigate);
  }

  // Glucose marking
  static setInitialGlucose(BG: number) {
    const session = WizardStore.session.value;
    if (!session.initialGlucose) {
      session.initialGlucose = BG;
    }
  }

  // Meal
  static markMeal() {
    const meal: Meal = WizardStore.meal.value;
    const session: Session = WizardStore.session.value;
    const timestamp = new Date();

    meal.timestamp = timestamp;
    session.addMeal(meal);
    this.resetMeal(); // Reset the meal to make room for additional

    // TODO: Use date selector
    RemoteTreatments.markMeal(meal.carbs, meal.protein, timestamp);
  }

  // Insulin
  private static insulin(units: number, BG: number) {
    const session: Session = WizardStore.session.value;
    const timestamp = new Date();

    session.createInsulin(units, timestamp, BG);

    // TODO: Use date selector
    RemoteTreatments.markInsulin(units, timestamp);
  }
  static markInsulin(units: number, BG: number) {
    let session: Session = WizardStore.session.value;
    if (session.insulinMarked) {
      if (
        !confirm(
          `You are going to mark additional insulin. You've already taken ${session.insulin}u of insulin. Are you sure you want to do this?`
        )
      )
        return;
    }
    this.insulin(units, BG);
  }
  // Glucose
  static markGlucose(grams: number) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    const session: Session = WizardStore.session.value;
    const timestamp = new Date();
    if (session.started) {
      session.createGlucose(grams, timestamp);
    }
    RemoteTreatments.markGlucose(grams, timestamp);
  }

  // Template selection
  private static getTemplateIndexByName(name: string): number {
    const templates = WizardStore.templates.value;
    for (let i = 0; i < templates.length; i++) {
      if (templates[i].name === name) return i;
    }
    throw new Error(`Cannot find template named ${name}`);
  }
  private static getTemplateByName(name: string): Template {
    const templates = WizardStore.templates.value;
    return templates[this.getTemplateIndexByName(name)];
  }
  private static replaceTemplateToArray() {
    const template = WizardStore.template.value;
    const index = this.getTemplateIndexByName(template.name);
    WizardStore.templates.value[index] = template;
    WizardStore.templates.write();
  }

  // Template functions
  static addSessionToTemplate(session: Session) {
    const template = WizardStore.template.value;
    template.addSession(session);
    WizardStore.template.write();
  }
  static selectTemplate(name: string) {
    // Select template to be used for all operations
    const template = this.getTemplateByName(name);
    WizardStore.template.value = template;
    if (!template.isFirstTime) {
      WizardStore.meal.value = Meal.deserialize(
        Meal.serialize(template.latestSession.latestMeal)
      );
    } else {
      WizardStore.meal.value = new Meal(new Date());
    }
    console.log(template);
  }
  static createTemplate(name: string) {
    try {
      this.selectTemplate(name);
    } catch (e) {
      const template = new Template(name);
      WizardStore.templates.value.push(template);
      WizardStore.templates.write();
      this.selectTemplate(name);
      return;
    }
    throw new Error(`Cannot create template named ${name}: already exists`);
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

  // Reset
  static resetTemplate() {
    this.addSessionToTemplate(WizardStore.session.value);
    this.replaceTemplateToArray();
    WizardStore.template.value = new Template("");
  }
  static resetSession() {
    WizardStore.session.value = new Session();
  }
  static resetMeal() {
    WizardStore.meal.value = new Meal(new Date());
  }
  static resetWizard(navigate: NavigateFunction) {
    this.resetSession(); // Reset the session
    this.resetMeal(); // Reset temporary meal
    this.moveToFirstPage(navigate); // Move to the first page
  }
  static cancelSession(navigate: NavigateFunction) {
    if (
      confirm(
        "Are you sure you want to discard the entire session? This will delete all data you've inputted so far for this session."
      )
    ) {
      this.resetWizard(navigate);
    }
  }
  static startNew(navigate: NavigateFunction) {
    this.resetTemplate();
    RemoteSessions.storeSession(WizardStore.session.value); // Store the entire session into nightscout so we can analyze it later
    this.resetWizard(navigate); // Reset the wizard states
  }
}
