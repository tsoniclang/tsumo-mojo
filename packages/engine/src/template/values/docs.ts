import type { DocsMountContext, NavItem } from "../../docs/models.js";
import type { TemplateValue } from "./base.js";

export class DocsMountValue {
  value: DocsMountContext;

  constructor(value: DocsMountContext) {
    this.value = value;
  }
}

export class DocsMountArrayValue {
  value: DocsMountContext[];

  constructor(value: DocsMountContext[]) {
    this.value = value;
  }
}

export class NavItemValue {
  value: NavItem;

  constructor(value: NavItem) {
    this.value = value;
  }
}

export class NavArrayValue {
  value: NavItem[];

  constructor(value: NavItem[]) {
    this.value = value;
  }
}
