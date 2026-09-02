import type { int32 } from "@tsonic/core/types.js";
import { HtmlString } from "../../utils/html.js";
import type { TemplateValue } from "./base.js";

export class StringValue {
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}

export class BoolValue {
  value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }
}

export class NumberValue {
  value: int32;

  constructor(value: int32) {
    this.value = value;
  }
}

export class HtmlValue {
  value: HtmlString;

  constructor(value: HtmlString) {
    this.value = value;
  }
}
