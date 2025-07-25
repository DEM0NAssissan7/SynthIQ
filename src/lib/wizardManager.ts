import Session from "../models/session";
import Meal from "../models/events/meal";
import { getStateName, WizardState } from "../models/types/wizardState";
import { wizardStorage } from "../storage/wizardStore";
import { type NavigateFunction } from "react-router";
import RemoteTreatments from "./remote/treatments";
import RemoteSessions from "./remote/sessions";

export default class WizardManager {
  // Page Redirects
  private static getPageRedirect(state: WizardState): string {
    return `/wizard/${getStateName(state)}`;
  }

  // Movement
  static moveToPage(state: WizardState, navigate: NavigateFunction): void {
    wizardStorage.set("state", state);
    navigate(this.getPageRedirect(state));
  }
  static moveToCurrentPage(navigate: NavigateFunction): void {
    this.moveToPage(wizardStorage.get("state"), navigate);
  }
  static moveToFirstPage(navigate: NavigateFunction): void {
    navigate(`/template/select`);
  }
  static begin(navigate: NavigateFunction) {
    this.moveToPage(WizardState.Meal, navigate);
  }

  // Activity
  static isActive() {
    return this.getMealMarked() || this.getInsulinMarked();
  }
  static isComplete() {
    return this.getMealMarked() && this.getInsulinMarked();
  }

  // Confirmations
  static getMealMarked() {
    const session = wizardStorage.get("session");
    return (
      wizardStorage.get("mealMarked") && (session.carbs || session.protein)
    );
  }
  static getInsulinMarked(): boolean {
    const session = wizardStorage.get("session");
    return wizardStorage.get("insulinMarked") && session.insulin !== 0;
  }
  static getInitialGlucoseMarked() {
    return wizardStorage.get("initialGlucoseMarked");
  }

  // Glucose marking
  static setInitialGlucose(BG: number, mark = true) {
    if (!this.getInitialGlucoseMarked()) {
      const session = wizardStorage.get("session") as Session;
      session.initialGlucose = BG;
      if (mark) wizardStorage.set("initialGlucoseMarked", true);
    }
  }

  // Meal
  static markMeal() {
    const meal: Meal = wizardStorage.get("meal");
    const session: Session = wizardStorage.get("session");
    const timestamp = new Date();

    meal.timestamp = timestamp;
    session.addMeal(meal);
    session.clearTests(); // Clear all test stuff on the session
    this.resetMeal(); // Reset the meal to make room for additional

    wizardStorage.set("mealMarked", true);

    // TODO: Use date selector
    RemoteTreatments.markMeal(meal.carbs, meal.protein, timestamp);
  }

  // Insulin
  private static insulin(units: number) {
    const session: Session = wizardStorage.get("session");
    const timestamp = new Date();

    session.createInsulin(timestamp, units);
    session.clearTests();

    wizardStorage.set("insulinMarked", true);

    // TODO: Use date selector
    RemoteTreatments.markInsulin(units, timestamp);
  }
  static markInsulin(units: number) {
    let session: Session = wizardStorage.get("session");
    if (this.getInsulinMarked()) {
      if (
        !confirm(
          `You are going to mark additional insulin. You've already taken ${session.insulin}u of insulin. Are you sure you want to do this?`
        )
      )
        return;
    }
    this.insulin(units);
  }
  // Glucose
  static markGlucose(caps: number) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    const session: Session = wizardStorage.get("session");
    const timestamp = new Date();
    if (session.insulin !== 0) {
      session.createGlucose(timestamp, caps);
      session.clearTests();

      // TODO: Use date selector
    }
    RemoteTreatments.markGlucose(caps, timestamp);
  }

  // Reset
  static resetSession() {
    const session = new Session();
    wizardStorage.set("session", session); // Reset session
    session.subscribe(() => wizardStorage.write("session")); // Automatically save the session when it changes
  }
  static resetMeal() {
    const meal = new Meal(new Date());
    wizardStorage.set("meal", meal); // Reset temporary meal
    meal.subscribe(() => wizardStorage.write("meal")); // Automatically save the meal when it changes
  }
  static resetWizard(navigate: NavigateFunction) {
    this.resetSession(); // Reset the session

    wizardStorage.set("mealMarked", false);
    wizardStorage.set("insulinMarked", false);
    wizardStorage.set("initialGlucoseMarked", false);

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
    const timestamp = new Date();
    const session: Session = wizardStorage.get("session");

    session.endTimestamp = timestamp; // Store the end time of the session
    RemoteSessions.storeSession(session); // Store the entire session into nightscout so we can analyze it later
    this.resetWizard(navigate); // Reset the wizard states
  }
}
