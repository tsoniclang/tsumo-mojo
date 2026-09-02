import type { TemplateValue } from "./base.js";

export class DictValue {
  value: Map<string, TemplateValue>;

  constructor(value: Map<string, TemplateValue>) {
    this.value = value;
  }
}
