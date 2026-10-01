/** Whole-input parsing cache with detached rule material and safe failure snapshots. */
import { type DetachedCacheValue, flatString } from "./byte_lru.js";
import { detachParseError } from "./cache_error.js";
import {
  cssRuleData,
  cssRuleIdentity,
  storeCssRuleData,
  storedCssRuleData,
} from "./rule_identity.js";
import type { CssRule, CssRuleParseResult, CssSegmentRun } from "./types.js";

const detachedRules = new WeakMap<CssRule, number>();
const detachedRuns = new WeakMap<
  CssSegmentRun,
  DetachedCacheValue<CssSegmentRun>
>();

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
    const retainedUnits = detachedRules.get(rule);
    if (retainedUnits !== undefined) {
      stringUnits += retainedUnits;
      return rule;
    }
    const initialUnits = stringUnits;
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
    const existing = storedCssRuleData(rule);
    if (existing)
      storeCssRuleData(copied, {
        addressKey: copyString(existing.addressKey),
        identityKey: copyString(existing.identityKey),
        rank: existing.rank,
        canonicalText: copyString(existing.canonicalText),
        references: Object.freeze(existing.references.map(copyString)),
      });
    else {
      const data = cssRuleData(copied);
      stringUnits +=
        data.addressKey.length +
        data.identityKey.length +
        data.canonicalText.length +
        data.references.reduce(
          (total, reference) => total + reference.length,
          0,
        );
    }
    detachedRules.set(copied, stringUnits - initialUnits);
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
  const retained = detachedRuns.get(run);
  if (retained) return retained;
  const detached = detachParseResult({ status: "parsed", rules: run.rules })!;
  const parsed = detached.value as Extract<
    CssRuleParseResult,
    { status: "parsed" }
  >;
  const identityRunKey = run.identityRunKey
    ? flatString(run.identityRunKey)
    : JSON.stringify(parsed.rules.map(cssRuleIdentity));
  const result = {
    value: Object.freeze({
      rules: parsed.rules,
      identityRunKey,
    }),
    ruleCount: detached.ruleCount,
    stringUnits: detached.stringUnits - "parsed".length + identityRunKey.length,
  };
  detachedRuns.set(result.value, result);
  return result;
}
