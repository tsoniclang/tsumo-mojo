import type { int32 } from "@tsonic/core/types.js";
import {
  regular_expression_is_valid,
  regular_expression_matches,
  regular_expression_replace,
  regular_expression_submatches,
  regular_expression_test,
} from "@tsonic/mojo/packages/tsumo-platform/index.js";
import { createTsumoError } from "../diagnostics.js";
import { JsonArray, JsonString, parseJson } from "./json.js";

export const testRegularExpression = (
  pattern: string,
  input: string,
  flags = "",
): boolean => {
  requireValidRegularExpression(pattern, flags);
  return regular_expression_test(pattern, flags, input);
};

export const findRegularExpressionMatches = (
  pattern: string,
  input: string,
  limit: int32,
): string[] => {
  requireValidRegularExpression(pattern, "g");
  if (limit === 0) return [];
  const matches = parseRegularExpressionArray(
    regular_expression_matches(pattern, input, limit),
  );
  const result: string[] = [];
  for (let index: int32 = 0; index < matches.items.length; index++) {
    const match = matches.items[index];
    if (!(match instanceof JsonString)) throw invalidRegularExpressionResult();
    result.push(match.value);
  }
  return result;
};

export const findRegularExpressionSubmatches = (
  pattern: string,
  input: string,
  limit: int32,
): string[][] => {
  requireValidRegularExpression(pattern, "g");
  if (limit === 0) return [];
  const matches = parseRegularExpressionArray(
    regular_expression_submatches(pattern, input, limit),
  );
  const result: string[][] = [];
  for (let index: int32 = 0; index < matches.items.length; index++) {
    const match = matches.items[index];
    if (!(match instanceof JsonArray)) throw invalidRegularExpressionResult();
    const row: string[] = [];
    for (let groupIndex: int32 = 0; groupIndex < match.items.length; groupIndex++) {
      const group = match.items[groupIndex];
      if (!(group instanceof JsonString)) throw invalidRegularExpressionResult();
      row.push(group.value);
    }
    result.push(row);
  }
  return result;
};

export const replaceRegularExpression = (
  pattern: string,
  replacement: string,
  input: string,
  limit: int32,
): string => {
  requireValidRegularExpression(pattern, "g");
  if (limit === 0) return input;
  return regular_expression_replace(pattern, replacement, input, limit);
};

const requireValidRegularExpression = (pattern: string, flags: string): void => {
  if (regular_expression_is_valid(pattern, flags)) return;
  throw createTsumoError(
    "TSUMO_TEMPLATE_REGEXP_INVALID",
    `Invalid regular expression '${pattern}'`,
  );
};

const parseRegularExpressionArray = (encoded: string): JsonArray => {
  const value = parseJson(encoded);
  if (!(value instanceof JsonArray)) throw invalidRegularExpressionResult();
  return value;
};

const invalidRegularExpressionResult = () =>
  createTsumoError(
    "TSUMO_TEMPLATE_REGEXP_RESULT_INVALID",
    "The native regular-expression boundary returned an invalid result",
  );
