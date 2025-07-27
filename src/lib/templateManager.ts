import type { NavigateFunction } from "react-router";
import Template from "../models/template";
import templateStore from "../storage/templateStore";
import WizardManager from "./wizardManager";
import { getStateName, TemplateState } from "../models/types/templateState";
import type Session from "../models/session";
import { setWizardMeal, wizardStorage } from "../storage/wizardStore";
import Meal from "../models/events/meal";

export default class TemplateManager {
  static getTemplates() {
    return templateStore.get("templates") as Template[];
  }
  private static getTemplateIndexByName(name: string): number {
    const templates = this.getTemplates();
    for (let i = 0; i < templates.length; i++) {
      if (templates[i].name === name) return i;
    }
    throw new Error(`Cannot find template named ${name}`);
  }
  private static getTemplateByName(name: string): Template {
    const templates = this.getTemplates();
    return templates[this.getTemplateIndexByName(name)];
  }
  private static replaceTemplateToArray() {
    const template = this.getTemplate();
    const index = this.getTemplateIndexByName(template.name);
    const templates = this.getTemplates();
    templates[index] = template;
    this.write();
  }
  private static write() {
    templateStore.write("template");
    templateStore.write("templates");
  }

  // Template management
  static selectTemplate(name: string) {
    // Select template to be used for all operations
    const template = this.getTemplateByName(name);
    templateStore.set("template", template);
    if (!template.isFirstTime) {
      setWizardMeal(
        Meal.parse(Meal.stringify(template.latestSession.latestMeal))
      );
    } else {
      setWizardMeal(new Meal(new Date())); // If it's the first time, we make the meal blank
    }
    console.log(template);
    this.write();
  }
  static getTemplate() {
    return templateStore.get("template") as Template;
  }
  static createTemplate(name: string) {
    try {
      this.selectTemplate(name);
    } catch (e) {
      const template = new Template(name);
      templateStore.get("templates").push(template);
      this.write();
      this.selectTemplate(name);
      return;
    }
    throw new Error(`Cannot create template named ${name}: already exists`);
  }
  static deleteTemplate(name: string) {
    const templates = templateStore.get("templates") as Template[];
    const index = templates.findIndex((t) => t.name === name);
    if (index === -1) {
      throw new Error(`Cannot delete template named ${name}: not found`);
    }
    templates.splice(index, 1);
    this.write();
  }

  // Template functions
  static addSessionToTemplate(session: Session) {
    const template = this.getTemplate();
    template.addSession(session);
    this.write();
  }

  // Movement
  private static getPageRedirect(state: TemplateState): string {
    return `/template/${getStateName(state)}`;
  }
  static moveToPage(state: TemplateState, navigate: NavigateFunction): void {
    templateStore.set("state", state);
    this.activate();
    navigate(this.getPageRedirect(state));
  }
  static moveToCurrentPage(navigate: NavigateFunction): void {
    if (this.isActive()) this.moveToPage(templateStore.get("state"), navigate);
    else WizardManager.moveToCurrentPage(navigate);
  }
  static moveToFirstPage(navigate: NavigateFunction): void {
    this.moveToPage(TemplateState.Select, navigate);
  }
  static begin(navigate: NavigateFunction) {
    const template = this.getTemplate();
    if (template.isFirstTime) {
      this.moveToPage(TemplateState.Meal, navigate);
    } else {
      this.moveToPage(TemplateState.Meal, navigate);
    }
  }

  // Activation
  static activate() {
    templateStore.set("active", true);
  }
  static deactivate() {
    templateStore.set("active", false);
  }
  static isActive() {
    return templateStore.get("active");
  }

  // Resetting
  static resetTemplate() {
    const session = wizardStorage.get("session");
    this.addSessionToTemplate(session);
    this.replaceTemplateToArray();
    templateStore.set("template", new Template(""));
  }
  static startNew(navigate: NavigateFunction) {
    this.resetTemplate();
    this.deactivate();
    WizardManager.startNew(navigate);
  }
}
