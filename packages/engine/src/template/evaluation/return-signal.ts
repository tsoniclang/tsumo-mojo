import type { TemplateValue } from "../values.js";

export class TemplateReturnSignal {
  value: TemplateValue;

  constructor(value: TemplateValue) {
    this.value = value;
  }
}
