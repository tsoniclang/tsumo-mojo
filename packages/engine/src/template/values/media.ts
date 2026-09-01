import { MediaType } from "../../models.js";
import type { TemplateValue } from "./base.js";

export class MediaTypeValue {
  value: MediaType;

  constructor(value: MediaType) {
    this.value = value;
  }
}
