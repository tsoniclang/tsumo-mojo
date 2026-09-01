import { OutputFormat, SiteContext } from "../../models.js";
import type { TemplateValue } from "./base.js";

export class OutputFormatsValue {
  site: SiteContext;

  constructor(site: SiteContext) {
    this.site = site;
  }
}

export class OutputFormatValue {
  value: OutputFormat;

  constructor(value: OutputFormat) {
    this.value = value;
  }
}

export class OutputFormatsGetValue {
  site: SiteContext;

  constructor(site: SiteContext) {
    this.site = site;
  }
}
