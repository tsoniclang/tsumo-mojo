import { LanguageContext, SiteContext } from "../../models.js";
import type { TemplateValue } from "./base.js";

export class SiteValue {
  value: SiteContext;

  constructor(value: SiteContext) {
    this.value = value;
  }
}

export class LanguageValue {
  value: LanguageContext;

  constructor(value: LanguageContext) {
    this.value = value;
  }
}

export class SitesValue {
  value: SiteContext;

  constructor(value: SiteContext) {
    this.value = value;
  }
}

export class SitesArrayValue {
  value: SiteContext[];

  constructor(value: SiteContext[]) {
    this.value = value;
  }
}
