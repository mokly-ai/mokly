/** Whole-input parsing cache with detached rule material and safe failure snapshots. */
import { type DetachedCacheValue, flatString } from "./byte_lru.js";
import { detachParseError } from "./cache_error.js";
import type { CssRule, CssRuleParseResult } from "./types.js";

export function detachParseResult(
  result: CssRuleParseResult,
): DetachedCacheValue<CssRuleParseResult> | undefined {
  if (result.status === "unresolved") {
    const detached = detachParseError(result.error);
    if (!detached) return;
    return {
      value: Object.freeze({ status: "unresolved", error: detached.error }),
      ruleCount: 0,
      stringUnits: result.status.length + detached.stringUnits,
    };
  }
  let stringUnits = result.status.length;
  const copyString = (text: string) => {
    stringUnits += text.length;
    return flatString(text);
  };
  const rules = result.rules.map((rule): CssRule => {
    const material = {
      ordinal: rule.ordinal,
      declarations: copyString(rule.declarations),
      hasCustomProperties: rule.hasCustomProperties,
      conditions: Object.freeze(
        rule.conditions.map((condition) =>
          Object.freeze({
            kind: copyString(condition.kind) as typeof condition.kind,
            prelude: copyString(condition.prelude),
          }),
        ),
      ),
    };
    return Object.freeze(
      rule.atRule === undefined
        ? {
            ...material,
            selectors: Object.freeze(rule.selectors.map(copyString)),
          }
        : {
            ...material,
            selectors: Object.freeze([]) as readonly [],
            atRule: copyString(rule.atRule),
            prelude: copyString(rule.prelude),
            block: rule.block,
          },
    );
  });
  return {
    value: Object.freeze({ status: "parsed", rules: Object.freeze(rules) }),
    ruleCount: rules.length,
    stringUnits,
  };
}
