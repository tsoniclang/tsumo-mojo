import type { int32 } from "@tsonic/core/types.js";

export class TextBuilder {
  #text: string;

  constructor() {
    this.#text = "";
  }

  length(): int32 {
    return this.#text.length as int32;
  }

  append(text: string): void {
    this.#text += text;
  }

  toString(): string {
    return this.#text;
  }
}
