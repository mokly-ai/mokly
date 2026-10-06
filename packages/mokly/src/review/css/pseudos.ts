/** Broaden browser-state selectors while preserving static and shadow constraints. */
import { parse, SelectorType, stringify } from "css-what";
import type { Selector } from "css-what";

import { CssSelectorError } from "./match_types.js";

const dynamicPseudos = new Set([
  "active",
  "hover",
  "visited",
  "link",
  "focus",
  "focus-visible",
  "focus-within",
  "target",
  "target-within",
  "local-link",
  "fullscreen",
  "modal",
  "picture-in-picture",
  "playing",
  "paused",
  "seeking",
  "buffering",
  "stalled",
  "muted",
  "volume-locked",
  "current",
  "past",
  "future",
  "autofill",
  "-webkit-autofill",
  "-moz-autofill",
  "checked",
  "indeterminate",
  "default",
  "valid",
  "invalid",
  "in-range",
  "out-of-range",
  "user-valid",
  "user-invalid",
  "read-only",
  "read-write",
  "placeholder-shown",
  "blank",
  "defined",
  "open",
  "popover-open",
  "state",
]);
const functionalDynamicPseudos = new Set([
  "state",
  "current",
  "past",
  "future",
]);
const shadowPseudos = new Set(["host", "host-context", "part", "slotted"]);

/** Properties of authored selectors, before broadening their unevaluable states. */
export interface SelectorFeatures {
  shadow: boolean;
  global: boolean;
  dynamic: boolean;
}

/** Inspect nested functional selectors as well as ordinary compounds. */
export function selectorFeatures(selectors: Selector[][]): SelectorFeatures {
  const features: SelectorFeatures = {
    shadow: false,
    global: false,
    dynamic: false,
  };
  for (const selector of selectors) {
    for (const token of selector) {
      features.global ||=
        token.type === SelectorType.Universal ||
        (token.type === SelectorType.Tag &&
          ["html", "body"].includes(token.name.toLowerCase()));
      if (
        token.type !== SelectorType.Pseudo &&
        token.type !== SelectorType.PseudoElement
      )
        continue;
      features.shadow ||= shadowPseudos.has(token.name);
      features.global ||=
        token.type === SelectorType.Pseudo && token.name === "root";
      features.dynamic ||=
        token.type === SelectorType.PseudoElement ||
        dynamicPseudos.has(token.name);
      const children = Array.isArray(token.data)
        ? token.data
        : nthSelectors(token)?.selectors;
      if (children) {
        const nested = selectorFeatures(children);
        features.shadow ||= nested.shadow;
        features.global ||= nested.global;
        features.dynamic ||= nested.dynamic;
      }
    }
  }
  return features;
}

/** Upper/lower match bounds prevent state stripping inside :not() from excluding matches. */
export function staticSelectors(
  selectors: Selector[][],
  possible = true,
  widenCounts = true,
): Selector[][] {
  return selectors.map((selector) =>
    selector.map((token): Selector => {
      if (token.type === SelectorType.PseudoElement) return truth(possible);
      if (token.type !== SelectorType.Pseudo) return { ...token };
      if (dynamicPseudos.has(token.name)) {
        if (token.data !== null && !functionalDynamicPseudos.has(token.name))
          throw new CssSelectorError("selector-parse-failed", {
            pseudo: token.name,
          });
        return truth(possible);
      }
      if (Array.isArray(token.data))
        return {
          ...token,
          data: staticSelectors(
            token.data,
            token.name === "not" ? !possible : possible,
            widenCounts,
          ),
        };
      const nth = nthSelectors(token);
      if (nth && selectorFeatures(nth.selectors).dynamic) {
        if (widenCounts) return truth(possible);
        return {
          ...token,
          data: `${nth.formula} of ${stringify(staticSelectors(nth.selectors, possible, false))}`,
        };
      }
      return { ...token };
    }),
  );
}

/** css-what retains nth-of selector lists as strings; expose their nested selectors. */
export function nthSelectors(
  token: Selector,
): { formula: string; selectors: Selector[][] } | undefined {
  if (
    token.type !== SelectorType.Pseudo ||
    !["nth-child", "nth-last-child"].includes(token.name) ||
    typeof token.data !== "string"
  )
    return undefined;
  const match = /^(.+?)\s+of\s+(.+)$/is.exec(token.data);
  return match
    ? { formula: match[1]!.trim(), selectors: parse(match[2]!.trim()) }
    : undefined;
}

function truth(value: boolean): Selector {
  const universal: Selector = { type: SelectorType.Universal, namespace: null };
  return value
    ? universal
    : { type: SelectorType.Pseudo, name: "not", data: [[universal]] };
}
