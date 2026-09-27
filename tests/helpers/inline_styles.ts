import assert from "node:assert/strict";

import { parse } from "parse5";

import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  ComponentViewRecord,
} from "@mokly/viewer";

import { validateComponentRanges } from "../../src/components/ranges.js";
import {
  attributeInlineRules,
  type InlineAttributionInput,
  type InlineAttributionResult,
} from "../../src/review/css/inline_attribution.js";
import type { InlineRuleAttribution } from "../../src/review/css/inline_rule_matching.js";
import { LightningCssRuleParser } from "../../src/review/css/rules.js";
import type { CssRuleParser } from "../../src/review/css/types.js";
import {
  normalizeHistoricalDocument,
  normalizeReviewPair,
} from "../../src/review/ignore.js";

export function key(seed: number): string {
  return seed.toString(16).padStart(64, "0");
}

export function instance(
  seed: number,
  componentId: string,
  options: {
    owner?: ComponentInputOwner;
    propsKey?: string;
  } = {},
): ComponentInstanceRecord {
  return {
    key: key(seed),
    id: `instance-${seed}`,
    componentId,
    owner: options.owner ?? { kind: "entry" },
    order: 0,
    props: {},
    propsKey: options.propsKey ?? key(seed + 1_000),
  };
}

export function slot(
  seed: number,
  receiver: ComponentInstanceRecord,
  owner: ComponentInputOwner,
): ComponentSlotRecord {
  return {
    key: key(seed),
    instanceKey: receiver.key,
    name: "children",
    owner,
  };
}

export function range(
  id: number,
  target: ComponentRangeRecord["target"],
  parentId?: number,
): ComponentRangeRecord {
  return {
    id: `r-${id}`,
    target,
    ...(parentId === undefined ? {} : { parentId: `r-${parentId}` }),
  };
}

export function view(
  options: {
    instances?: readonly ComponentInstanceRecord[];
    slots?: readonly ComponentSlotRecord[];
    ranges?: readonly ComponentRangeRecord[];
  } = {},
): ComponentViewRecord {
  return {
    viewport: "mobile",
    colorScheme: "light",
    instances: options.instances ?? [],
    slots: options.slots ?? [],
    ranges: options.ranges ?? [],
  };
}

export function markedRange(
  id: number,
  content: string,
  dialect: "current" | "historical" = "current",
): string {
  const prefix = dialect === "historical" ? "mokabook" : "mokly";
  return `<!--${prefix}-component:start:r-${id}-->${content}<!--${prefix}-component:end:r-${id}-->`;
}

export function html(styles: string, body: string): string {
  return `<!doctype html><html><head>${styles}</head><body>${body}</body></html>`;
}

export function inlineInput(options: {
  before: string;
  after: string;
  beforeUsage?: ComponentViewRecord;
  afterUsage?: ComponentViewRecord;
  rootComponentId?: string;
  parser?: CssRuleParser;
}): InlineAttributionInput {
  const beforeUsage = options.beforeUsage ?? view();
  const afterUsage = options.afterUsage ?? view();
  const normalizedBefore = normalizeHistoricalDocument(options.before);
  const normalized = normalizeReviewPair(
    normalizedBefore,
    options.after,
    "inline-test.html",
  );
  return {
    before: {
      source: options.before,
      sourceRanges: validateComponentRanges(
        options.before,
        beforeUsage.ranges,
        "historical",
      ),
      usage: beforeUsage,
    },
    after: {
      source: options.after,
      sourceRanges: validateComponentRanges(options.after, afterUsage.ranges),
      usage: afterUsage,
    },
    pairedIgnoreIds: normalized.pairedIgnoreIds,
    ...(options.rootComponentId
      ? { rootComponentId: options.rootComponentId }
      : {}),
    parser: options.parser ?? new LightningCssRuleParser(),
    prepare: () => ({
      before: {
        document: parse(normalized.base, { sourceCodeLocationInfo: true }),
        ranges: validateComponentRanges(normalized.base, beforeUsage.ranges),
      },
      after: {
        document: parse(normalized.head, { sourceCodeLocationInfo: true }),
        ranges: validateComponentRanges(normalized.head, afterUsage.ranges),
      },
    }),
  };
}

export function analyzeInline(options: Parameters<typeof inlineInput>[0]): {
  input: InlineAttributionInput;
  result: InlineAttributionResult;
} {
  const input = inlineInput(options);
  return { input, result: attributeInlineRules(input) };
}

export function changedStyle(selector = ".target") {
  return {
    before: `<style>${selector}{color:red}</style>`,
    after: `<style>${selector}{color:blue}</style>`,
  };
}

export function resolved(
  result: InlineAttributionResult,
): Extract<InlineAttributionResult, { status: "resolved" }> {
  assert.equal(result.status, "resolved");
  assert.ok(result.status === "resolved");
  return result;
}

export function oneAttribution(
  result: InlineAttributionResult,
): InlineRuleAttribution {
  const value = resolved(result);
  assert.equal(value.rules.length, 1);
  return value.rules[0]!.attribution;
}
