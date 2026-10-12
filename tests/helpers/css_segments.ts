import assert from "node:assert/strict";

import { cssRuleData } from "../../src/review/css/rule_identity.js";
import { LightningCssRuleParser } from "../../src/review/css/rules.js";
import { CssSegmentAnalysis } from "../../src/review/css/segment_analysis.js";
import type { CssRuleParseResult } from "../../src/review/css/types.js";

import { assembleInlineParse } from "./inline_parse.js";

export function parseSnapshot(result: CssRuleParseResult): unknown {
  return result.status === "parsed"
    ? { ...result, derived: result.rules.map(cssRuleData) }
    : { status: result.status, error: errorSnapshot(result.error) };
}

function errorSnapshot(value: unknown): unknown {
  if (value instanceof Error)
    return Object.fromEntries(
      ["name", ...Object.getOwnPropertyNames(value)]
        .filter((key) => key !== "stack")
        .map((key) => [key, errorSnapshot(Reflect.get(value, key))]),
    );
  if (Array.isArray(value)) return value.map(errorSnapshot);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        errorSnapshot(nested),
      ]),
    );
  return value;
}

export function segmentOracle(cacheBytes?: number) {
  const native = new LightningCssRuleParser();
  const inline = new CssSegmentAnalysis(native, cacheBytes);
  return (source: string, context: string) => {
    const assembled = assembleInlineParse(inline.parseRuns(source));
    const whole = native.parse(source);
    assert.deepEqual(parseSnapshot(assembled), parseSnapshot(whole), context);
    return assembled;
  };
}
