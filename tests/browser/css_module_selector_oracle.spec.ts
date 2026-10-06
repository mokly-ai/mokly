import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { expect, test } from "@playwright/test";

import { scopeModule } from "../../packages/mokly/dist/build/styles/modules.js";
import { pluginModuleOutput } from "../helpers/css_module_plugin_output.js";

import {
  oracleCases,
  oracleSeed,
  type OracleCase,
  type SelectorFamily,
} from "./css_module_selector_oracle_cases.js";

interface Comparison {
  readonly name: string;
  readonly authored: string;
  readonly delivered: string;
  readonly accepted: boolean;
  readonly strict: boolean;
  readonly family?: SelectorFamily;
  readonly kind?: OracleCase["kind"];
}

test(`seeded Chrome selector oracle (seed ${oracleSeed})`, async ({ page }) => {
  const started = performance.now();
  const relative = "entries/oracle.module.css";
  const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
  const comparisons: Comparison[] = [];
  for (const candidate of oracleCases) {
    const delivered = pluginModuleOutput(
      candidate.css,
      relative,
      prefix,
    ).css.replaceAll(prefix, "");
    let accepted = true;
    try {
      scopeModule(candidate.css, relative);
    } catch {
      accepted = false;
    }
    comparisons.push({
      name: candidate.name,
      authored:
        candidate.expected === undefined
          ? candidate.css
          : candidate.kind
            ? candidate.expected
            : `${candidate.expected}{color:red}`,
      delivered,
      accepted,
      strict: candidate.strict ?? false,
      ...(candidate.family ? { family: candidate.family } : {}),
      ...(candidate.kind ? { kind: candidate.kind } : {}),
    });
  }
  const results: { authored: string | null; delivered: string | null }[] = [];
  for (let index = 0; index < comparisons.length; index += 80)
    results.push(
      ...(await page.evaluate(
        (items) => {
          const parsed = (css: string, kind?: "nested" | "scope") => {
            const sheet = new CSSStyleSheet();
            try {
              sheet.replaceSync(css);
            } catch {
              return null;
            }
            const first = sheet.cssRules[0];
            if (!first) return null;
            if (kind === "nested")
              return (
                (
                  (first as CSSStyleRule).cssRules?.[0] as
                    CSSStyleRule | undefined
                )?.selectorText ?? null
              );
            if (kind === "scope") {
              const scope = first as CSSScopeRule;
              return `${scope.start}|${scope.end}`;
            }
            return (first as CSSStyleRule).selectorText ?? null;
          };
          return items.map((item) => ({
            authored: parsed(item.authored, item.kind),
            delivered: parsed(item.delivered, item.kind),
          }));
        },
        comparisons.slice(index, index + 80),
      )),
    );

  const familyCounts = new Map<SelectorFamily, number>();
  let strictRejections = 0;
  for (const [index, comparison] of comparisons.entries()) {
    const result = results[index]!;
    expect(
      result.authored,
      `${comparison.name}: authored CSS must parse`,
    ).not.toBeNull();
    expect(
      result.delivered,
      `${comparison.name}: delivered CSS must parse`,
    ).not.toBeNull();
    if (comparison.family)
      familyCounts.set(
        comparison.family,
        (familyCounts.get(comparison.family) ?? 0) + 1,
      );
    if (comparison.accepted) {
      expect(result.delivered, comparison.name).toBe(result.authored);
      expect(comparison.strict, comparison.name).toBe(false);
    } else if (result.authored === result.delivered) {
      // A trailing comma in a non-wrapper pseudo may move harmless whitespace;
      // the rename-only check deliberately keeps its pre-existing strict rejection.
      expect(comparison.strict, comparison.name).toBe(true);
      strictRejections += 1;
    } else expect(comparison.strict, comparison.name).toBe(false);
  }
  for (const family of [
    "is",
    "where",
    "not",
    "has",
    "nth-child",
    "host",
    "slotted",
  ] as const)
    expect(
      familyCounts.get(family) ?? 0,
      `${family} real comparisons`,
    ).toBeGreaterThanOrEqual(10);
  test.info().annotations.push({
    type: "oracle",
    description: `${oracleCases.length} parsed cases; ${JSON.stringify(Object.fromEntries(familyCounts))}; ${strictRejections} tolerated strict rejections; ${(performance.now() - started).toFixed(1)} ms`,
  });
});
