import type { TemplateValue } from "./base.js";

export class StringArrayValue {
  value: string[];

  constructor(value: string[]) {
    this.value = value;
  }
}

export class AnyArrayValue {
  value: TemplateValue[];

  constructor(value: TemplateValue[]) {
    this.value = value;
  }
}
