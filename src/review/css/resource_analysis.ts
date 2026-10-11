/** Cache parser results and retain rule proof until catalogue attribution completes. */
import { isStylesheetPath } from "@mokly/viewer/data";
import type {
  DependencyReason,
  ExcludedResource,
  ResourceEvidence,
} from "@mokly/viewer/data";

import { analyzeStylesheetChange } from "./analyze.js";
import {
  CssAttribution,
  outputMatch,
  type CollectedCssRule,
} from "./attribution.js";
import type { CssMatchingPair } from "./containment.js";
import { CssRuleIdentities } from "./identity.js";
import { matchCssRules } from "./match.js";
import { LightningCssRuleParser } from "./rules.js";
import {
  CssRuleParseError,
  type CssRuleParser,
  type CssRuleParseResult,
} from "./types.js";

/** Resource bytes are supplied only after confinement and changed-path checks. */
export interface ChangedResource {
  path: string;
  before?: string;
  after?: string;
}

export interface ResourceMatchingPair extends CssMatchingPair {
  /** The stylesheets that apply in this document; omitted for standalone callers. */
  paths?: ReadonlySet<string>;
}

export class CssResourceAnalysis {
  private readonly parsed = new Map<string, CssRuleParseResult>();
  private readonly cached: CssRuleParser;
  private readonly identities = new CssRuleIdentities();
  readonly attribution = new CssAttribution();

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

  analyze(
    resources: readonly ChangedResource[],
    documents: readonly ResourceMatchingPair[],
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
      const rules = this.rules(resource, documents);
      if (rules.length)
        reasons.push({
          kind: "dependency",
          path: resource.path,
          analysis: this.attribution.record(rules),
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

  private rules(
    resource: ChangedResource,
    documents: readonly ResourceMatchingPair[],
  ): CollectedCssRule[] {
    const result: CollectedCssRule[] = [];
    for (const pair of documents.length ? documents : [{}]) {
      if (pair.paths && !pair.paths.has(resource.path)) continue;
      const analysed = analyzeStylesheetChange(
        resource.before ?? "",
        resource.after ?? "",
        pair,
        this.cached,
        this.matcher,
      );
      if (analysed.kind === "excluded") continue;
      if (!analysed.rules.length)
        return [
          { status: "unresolved", selectors: analysed.selectors, matches: [] },
        ];
      for (const { change, outcome, matches } of analysed.rules) {
        if (outcome.kind === "excluded") continue;
        result.push({
          ruleKey: this.identities.key(change),
          status: outcome.status,
          selectors: outcome.selectors,
          matches:
            outcome.status === "matched"
              ? matches.map((match) => outputMatch(match, pair))
              : [],
        });
      }
    }
    return result;
  }
}
