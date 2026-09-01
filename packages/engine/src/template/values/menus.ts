import { MenuEntry, SiteContext } from "../../models.js";
import type { TemplateValue } from "./base.js";

export class MenuEntryValue {
  value: MenuEntry;
  site: SiteContext;

  constructor(value: MenuEntry, site: SiteContext) {
    this.value = value;
    this.site = site;
  }
}

export class MenuArrayValue {
  value: MenuEntry[];
  site: SiteContext;

  constructor(value: MenuEntry[], site: SiteContext) {
    this.value = value;
    this.site = site;
  }
}

export class MenusValue {
  site: SiteContext;

  constructor(site: SiteContext) {
    this.site = site;
  }
}
