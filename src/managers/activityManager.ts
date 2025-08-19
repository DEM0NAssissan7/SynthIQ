import type { NavigateFunction } from "react-router";
import { ActivityStore } from "../storage/activityStore";
import { ActivityTemplate } from "../models/activityTemplate";
import {
  ActivityPage,
  serializeActivityPage,
} from "../models/types/activityPage";
import Activity from "../models/events/activity";
import WizardManager from "./wizardManager";

export namespace ActivityManager {
  // Navigation
  export function navigateToCurrentPage(navigate: NavigateFunction) {
    const pageName = serializeActivityPage(ActivityStore.page.value);
    navigate(`/activity/${pageName}`);
  }
  export function navigateTo(navigate: NavigateFunction, page: ActivityPage) {
    ActivityStore.page.value = page;
    navigateToCurrentPage(navigate);
  }

  // Template Management
  export function createTemplate(name: string) {
    // Ensure no duplicate templates
    try {
      selectTemplate(name);
      return;
    } catch (e) {}

    const newTemplate = new ActivityTemplate(name);
    const newTemplates = [...ActivityStore.templates.value, newTemplate];
    ActivityStore.templates.value = newTemplates;
    selectTemplate(name);
  }
  export function selectTemplate(name: string) {
    const templates = ActivityStore.templates.value;
    for (let template of templates) {
      if (template.name === name) {
        ActivityStore.template.value = template;
        ActivityStore.activity.value = new Activity(template.name);
        return;
      }
    }
    throw new Error(`Cannot select template '${name}': does not exist`);
  }
  export function deleteTemplate(name: string) {
    const templates = ActivityStore.templates.value;
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      if (template.name === name) {
        templates.splice(i, 1);
        break;
      }
    }
    ActivityStore.templates.write();
  }
  function updateTemplate(template: ActivityTemplate) {
    const templates = ActivityStore.templates.value;
    for (let i = 0; i < templates.length; i++) {
      if (templates[i].name === template.name) {
        templates[i] = template;
        break;
      }
    }
    ActivityStore.templates.write();
  }

  // Housekeeping
  function resetStates() {
    ActivityStore.template.value = new ActivityTemplate(""); // Reset activity
    ActivityStore.activity.value = new Activity(""); // Reset activity
    ActivityStore.page.reset();
  }

  // Execution
  export function begin(navigate: NavigateFunction, initialBG: number) {
    ActivityStore.activity.value.initialBG = initialBG;
    ActivityStore.activity.write();
    navigateTo(navigate, ActivityPage.End);
  }
  export function cancel(navigate: NavigateFunction) {
    resetStates();
    navigate("/hub");
  }
  export function end(navigate: NavigateFunction, finalBG: number) {
    const activity = ActivityStore.activity.value;
    const template = ActivityStore.template.value;

    activity.finalBG = finalBG;
    template.addActivity(activity);
    WizardManager.markActivity(activity); // Communicate with the wizard to store the activity
    updateTemplate(template);

    cancel(navigate);
  }
}
