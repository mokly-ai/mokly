/** Cache parsing and contain per-resource failures during evidence reduction. */
import type { DependencyReason, ExcludedResource } from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { analyzeStylesheetChange } from "./analyze.js";
import { diffCssRules } from "./diff.js";
import type { CssDocumentPair } from "./document.js";
import { matchCssRules } from "./match.js";
import type { CssAnalysisOutcome } from "./match_types.js";
import { LightningCssRuleParser } from "./rules.js";
import {
  CssRuleParseError,
  type CssRuleParser,
  type CssRuleParseResult,
} from "./types.js";

/** Resource identities and immutable source-side bytes, supplied after confinement. */
export interface ChangedResource {
  path: string;
  before?: string;
  after?: string;
}

/** Optional view evidence is absent when empty, including on historical results. */
export interface ResourceEvidence {
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
}

/** One parser cache per classification, shared across paths, views and source sides. */
export class CssResourceAnalysis {
  private readonly parsed = new Map<string, CssRuleParseResult>();
  private readonly cached: CssRuleParser;

  constructor(
    parser: CssRuleParser = new LightningCssRuleParser(),
    private readonly matcher: typeof matchCssRules = matchCssRules,
  ) {
    this.cached = {
      parse: (source) => {
        let result = this.parsed.get(source);
        if (!result) {
          try {
            result = parser.parse(source);
          } catch (cause) {
            result = {
              status: "unresolved",
              error: new CssRuleParseError(cause),
            };
          }
          this.parsed.set(source, result);
        }
        return result;
      },
    };
  }

  /** Narrow only the supplied changed, reachable resources; never discover files here. */
  analyze(
    resources: readonly ChangedResource[],
    documents: readonly CssDocumentPair[],
  ): ResourceEvidence {
    const reasons: DependencyReason[] = [];
    const excludedResources: ExcludedResource[] = [];
    for (const resource of [...resources].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    )) {
      if (!isStylesheetPath(resource.path)) {
        reasons.push({ kind: "dependency", path: resource.path });
        continue;
      }
      let outcomes: CssAnalysisOutcome[];
      try {
        outcomes = (documents.length ? documents : [{}]).map((pair) =>
          analyzeStylesheetChange(
            resource.before ?? "",
            resource.after ?? "",
            pair,
            this.cached,
            this.matcher,
          ),
        );
      } catch {
        outcomes = [
          {
            kind: "kept",
            status: "unresolved",
            selectors: this.changedSelectors(resource),
          },
        ];
      }
      const kept = outcomes.filter((outcome) => outcome.kind === "kept");
      if (kept.length)
        reasons.push({
          kind: "dependency",
          path: resource.path,
          analysis: {
            status: kept.some((outcome) => outcome.status === "unresolved")
              ? "unresolved"
              : "matched",
            selectors: [
              ...new Set(kept.flatMap((outcome) => outcome.selectors)),
            ].sort(),
          },
        });
      else
        excludedResources.push({
          path: resource.path,
          reason: "no-matching-rule",
        });
    }
    return {
      ...(reasons.length ? { reasons } : {}),
      ...(excludedResources.length ? { excludedResources } : {}),
    };
  }

  /** Recover serialized changed selectors without allowing a second failure to escape. */
  private changedSelectors(resource: ChangedResource): readonly string[] {
    try {
      const diff = diffCssRules(
        resource.before ?? "",
        resource.after ?? "",
        this.cached,
      );
      if (diff.status === "unresolved") return [];
      return [
        ...new Set(
          [
            ...diff.added,
            ...diff.removed,
            ...diff.changed.flatMap(({ before, after }) => [before, after]),
          ].flatMap((rule) => rule.selectors),
        ),
      ].sort();
    } catch {
      return [];
    }
  }
}
