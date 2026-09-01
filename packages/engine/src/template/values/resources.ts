import { Resource, ResourceData } from "../../resources.js";
import type { ResourceManager } from "../../resources.js";
import type { TemplateValue } from "./base.js";

export class ResourceNamespaceValue {}

export class ResourceDataValue {
  value: ResourceData;

  constructor(value: ResourceData) {
    this.value = value;
  }
}

export class ResourceValue {
  value: Resource;
  manager: ResourceManager;

  constructor(manager: ResourceManager, value: Resource) {
    this.manager = manager;
    this.value = value;
  }
}
