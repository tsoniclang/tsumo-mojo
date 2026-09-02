import type { TemplateValue } from "./base.js";

export class DeferredTemplateValue {
  key: string | undefined;
  data: TemplateValue;

  constructor(key: string | undefined, data: TemplateValue) {
    this.key = key;
    this.data = data;
  }
}
