import { PageContext, SiteContext } from "../../models.js";
import type { TemplateValue } from "./base.js";

export class TaxonomiesValue {
  site: SiteContext;

  constructor(site: SiteContext) {
    this.site = site;
  }
}

export class TaxonomyTermsValue {
  terms: Map<string, PageContext[]>;
  site: SiteContext;

  constructor(terms: Map<string, PageContext[]>, site: SiteContext) {
    this.terms = terms;
    this.site = site;
  }
}
