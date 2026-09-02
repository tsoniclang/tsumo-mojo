import type { int32 } from "@tsonic/core/types.js";
import { isDecimalIntegerSyntax } from "./decimal-integer-syntax.js";

export const parseIntArg = (value: string): int32 | undefined => {
  const trimmed = value.trim();
  if (!isDecimalIntegerSyntax(trimmed, true)) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (
    Number.isInteger(parsed) &&
    parsed >= -2147483648 &&
    parsed <= 2147483647
  ) {
    return parsed as int32;
  }
  return undefined;
};
