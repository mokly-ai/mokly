/** Whole-input parsing cache with detached rule material and safe failure snapshots. */
import { type DetachedCacheValue, flatString } from "./byte_lru.js";
import { detachParseError } from "./cache_error.js";
import { cssRuleData, storeCssRuleData } from "./rule_identity.js";
import type { CssRule, CssRuleParseResult, CssSegmentRun } from "./types.js";

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
    const copied = Object.freeze(
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
    const data = cssRuleData(rule);
    storeCssRuleData(copied, {
      addressKey: copyString(data.addressKey),
      identityKey: copyString(data.identityKey),
      rank: data.rank,
      canonicalText: copyString(data.canonicalText),
      references: Object.freeze(data.references.map(copyString)),
    });
    return copied;
  });
  return {
    value: Object.freeze({ status: "parsed", rules: Object.freeze(rules) }),
    ruleCount: rules.length,
    stringUnits,
  };
}

export function detachSegmentRun(
  run: CssSegmentRun,
): DetachedCacheValue<CssSegmentRun> {
  const detached = detachParseResult({ status: "parsed", rules: run.rules })!;
  const parsed = detached.value as Extract<
    CssRuleParseResult,
    { status: "parsed" }
  >;
  return {
    value: Object.freeze({
      rules: parsed.rules,
      identityRunKey: flatString(run.identityRunKey),
    }),
    ruleCount: detached.ruleCount,
    stringUnits:
      detached.stringUnits - "parsed".length + run.identityRunKey.length,
  };
}
