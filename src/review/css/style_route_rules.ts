/** Condition 5 guards full-rule references and child-content selector predicates. */
import { parse, SelectorType, type Selector } from "css-what";

import type { PreparedInlineRules } from "./inline_preparation.js";
import { resolveRuleSelectors } from "./nesting.js";
import { nthSelectors } from "./pseudos.js";
import { cssRuleData } from "./rule_identity.js";

const textPseudos = new Set(["empty", "parent", "contains", "icontains"]);

export function styleRouteRulesSafe(prepared: PreparedInlineRules): boolean {
  if (prepared.status !== "resolved") return false;
  return prepared.deltas.every((change) => {
    if (change.kind === "unchanged") return true;
    return [change.before, change.after].every((rule) => {
      if (!rule) return true;
      if (cssRuleData(rule).references.length) return false;
      try {
        return !resolveRuleSelectors(rule).some((selector) =>
          childContent(parse(selector)),
        );
      } catch {
        // Unresolvable selectors keep their ordinary unresolved attribution.
        return true;
      }
    });
  });
}

function childContent(selectors: Selector[][]): boolean {
  return selectors.some((selector) =>
    selector.some((token) => {
      if (
        token.type !== SelectorType.Pseudo &&
        token.type !== SelectorType.PseudoElement
      )
        return false;
      if (token.type === SelectorType.Pseudo && textPseudos.has(token.name))
        return true;
      const children = Array.isArray(token.data)
        ? token.data
        : nthSelectors(token)?.selectors;
      return children ? childContent(children) : false;
    }),
  );
}
