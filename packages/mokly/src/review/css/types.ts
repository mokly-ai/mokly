/** Unevaluated context surrounding a stylesheet rule, outermost first. */
export interface CssRuleCondition {
  kind: "media" | "container" | "supports" | "layer" | "nesting-parent";
  prelude: string;
}

/** Common rule material, captured before stylesheet optimization. */
interface CssRuleMaterial {
  /** Zero-based depth-first position; never part of the rule's identity. */
  ordinal: number;
  declarations: string;
  conditions: readonly CssRuleCondition[];
  hasCustomProperties: boolean;
}

/** A style rule, or a complete selector-less at-rule retained conservatively. */
export type CssRule = CssRuleMaterial &
  (
    | { selectors: readonly string[]; atRule?: never; prelude?: never }
    | { selectors: readonly []; atRule: string; prelude: string }
  );

/** A parsing or serialization failure; the original error remains its cause. */
export class CssRuleParseError extends Error {
  readonly code = "css-parse-failed";

  constructor(cause: unknown) {
    super("[mokly/review/css] stylesheet rules could not be parsed", { cause });
    this.name = "CssRuleParseError";
  }
}

/** Failed parses never expose a partial rule list. */
export type CssRuleParseResult =
  | { status: "parsed"; rules: readonly CssRule[] }
  | { status: "unresolved"; error: CssRuleParseError };

/** The sole parsing boundary; callers may inject already-parsed test fixtures. */
export interface CssRuleParser {
  parse(stylesheet: string): CssRuleParseResult;
}

/** The same rule address with different declaration material. */
export interface CssRuleChange {
  before: CssRule;
  after: CssRule;
}

/** No diff lists are available when either side cannot be parsed completely. */
export type CssRuleDiffResult =
  | {
      status: "resolved";
      added: readonly CssRule[];
      removed: readonly CssRule[];
      /** Changes sort by their after-side ordinal. */
      changed: readonly CssRuleChange[];
    }
  | {
      status: "unresolved";
      failures: readonly {
        side: "before" | "after";
        error: CssRuleParseError;
      }[];
    };
