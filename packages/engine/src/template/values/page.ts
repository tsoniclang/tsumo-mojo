import { PageContext, PageFile } from "../../models.js";
import type { ResourceManager } from "../../resources.js";
import type { TemplateValue } from "./base.js";

export class PageValue {
  value: PageContext;

  constructor(value: PageContext) {
    this.value = value;
  }
}

export class FileValue {
  value: PageFile;

  constructor(value: PageFile) {
    this.value = value;
  }
}

export class PageArrayValue {
  value: PageContext[];

  constructor(value: PageContext[]) {
    this.value = value;
  }
}

export class PageGroupValue {
  key: TemplateValue;
  pages: PageContext[];

  constructor(key: TemplateValue, pages: PageContext[]) {
    this.key = key;
    this.pages = pages;
  }
}

export class PageDataValue {
  page: PageContext;

  constructor(page: PageContext) {
    this.page = page;
  }
}

export class PageResourcesValue {
  page: PageContext;
  manager: ResourceManager;

  constructor(page: PageContext, manager: ResourceManager) {
    this.page = page;
    this.manager = manager;
  }
}
