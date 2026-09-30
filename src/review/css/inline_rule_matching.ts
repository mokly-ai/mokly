import { documentWorkSync } from "../../diagnostics/timings.js";

/** Attribute one diffed inline rule through matched document elements. */
import type { CssDocument } from "./document.js";
import { selectDocument } from "./document_query.js";
import type {
  ElementOwnerIndex,
  InlineElementOwner,
} from "./element_owners.js";
import { prepareCssRule } from "./match.js";
import { CssSelectorError } from "./match_types.js";
import type { CssRuleDelta } from "./match_types.js";

/** Exclusive attribution outcome for one diffed inline rule. */
export type InlineRuleAttribution =
  | { kind: "unresolved" }
  | { kind: "excluded" }
  | { kind: "entry" }
  | { kind: "owned"; componentIds: readonly string[] };

/** Analyzed diff/reference material, its selectors, and inferred owner. */
export interface AttributedInlineRule {
  change: CssRuleDelta;
  attribution: InlineRuleAttribution;
  selectors: readonly string[];
}

interface MatchSide {
  document: CssDocument;
  owners: ElementOwnerIndex;
}

/** Apply the shared keep list, then collect every matched element owner. */
export function attributeInlineRule(
  change: CssRuleDelta,
  before: MatchSide,
  after: MatchSide,
): AttributedInlineRule {
  return documentWorkSync("matchingMs", () => {
    const prepared = prepareCssRule(change, "matchable");
    if (prepared.status === "unresolved")
      return {
        change,
        attribution: { kind: "unresolved" },
        selectors: prepared.selectors,
      };
    const owners: InlineElementOwner[] = [];
    try {
      for (const query of prepared.queries)
        for (const side of [before, after])
          for (const element of selectDocument(query, side.document)) {
            const offset = element.sourceCodeLocation?.startOffset;
            owners.push(
              offset === undefined
                ? { kind: "entry" }
                : side.owners.ownerAt(offset),
            );
          }
    } catch (error) {
      if (!(error instanceof CssSelectorError)) throw error;
      return {
        change,
        attribution: { kind: "unresolved" },
        selectors: prepared.selectors,
      };
    }
    return {
      change,
      attribution: reduceOwners(owners),
      selectors: prepared.selectors,
    };
  });
}

function reduceOwners(
  owners: readonly InlineElementOwner[],
): InlineRuleAttribution {
  if (!owners.length) return { kind: "excluded" };
  if (owners.some((owner) => owner.kind === "entry")) return { kind: "entry" };
  return {
    kind: "owned",
    componentIds: [
      ...new Set(
        owners.flatMap((owner) =>
          owner.kind === "component" ? [owner.componentId] : [],
        ),
      ),
    ].sort(),
  };
}
