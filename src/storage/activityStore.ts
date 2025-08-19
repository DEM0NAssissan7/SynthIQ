import Serialization from "../lib/serialization";
import { ActivityTemplate } from "../models/activityTemplate";
import Activity from "../models/events/activity";
import {
  ActivityPage,
  deserializeActivityPage,
  serializeActivityPage,
} from "../models/types/activityPage";
import StorageNode from "./storageNode";

export namespace ActivityStore {
  const node = new StorageNode("activity");

  export const templates = node.add(
    "templates",
    [],
    Serialization.getArraySerializer(ActivityTemplate.serialize),
    Serialization.getArrayDeserializer(ActivityTemplate.deserialize)
  );
  export const template = node.add(
    "template",
    new ActivityTemplate(""),
    ActivityTemplate.serialize,
    ActivityTemplate.deserialize
  );

  export const activity = node.add(
    "activity",
    new Activity(),
    Activity.serialize,
    Activity.deserialize
  );

  export const page = node.add(
    "page",
    ActivityPage.Select,
    serializeActivityPage,
    deserializeActivityPage
  );
}
