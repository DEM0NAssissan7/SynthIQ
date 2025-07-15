import StorageNode from "../lib/storageNode";
import Template from "../models/template";
import { TemplateState } from "../models/types/templateState";

const templateStore = new StorageNode("template");
export default templateStore;

templateStore.add(
  "templates",
  [] as Template[],
  (s: string) => JSON.parse(s).map((a: string) => Template.parse(a)),
  (t: Template[]) => JSON.stringify(t.map((a) => Template.stringify(a)))
);

templateStore.add(
  "template",
  new Template(""),
  (s: string) => Template.parse(s),
  (a: any) => Template.stringify(a)
);

templateStore.add("state", TemplateState.Hub);
templateStore.add("active", false);
