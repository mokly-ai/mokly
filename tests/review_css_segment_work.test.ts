import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRuleLists } from "../src/review/css/diff.js";
import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import { inlineMaterialReplacements } from "../src/review/css/inline_rendering.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import {
  cssRuleData,
  storeCssRuleData,
} from "../src/review/css/rule_identity.js";

import { html, inlineInput, resolved } from "./helpers/inline_styles.js";

for (const count of [10, 1000])
  test(`${count} to ${count + 1} cumulative segments diff and attribute only one rule`, () => {
    const source = Array.from(
      { length: count },
      (_, index) => `.r${index}{color:red}`,
    ).join("");
    const input = inlineInput({
      before: html(`<style>${source}</style>`, '<main class="new"></main>'),
      after: html(
        `<style>${source}.new{color:blue}</style>`,
        '<main class="new"></main>',
      ),
      parser: new CssResourceAnalysis().parser,
    });
    let diffCount = 0;
    input.diffRules = (before, after) => {
      diffCount += before.length + after.length;
      return diffCssRuleLists(before, after);
    };
    const result = resolved(attributeInlineRules(input));
    assert.equal(diffCount, 1);
    assert.equal(result.rules.length, 1);
    assert.equal(result.rules[0]!.change.after?.ordinal, count);
    let copies = 0;
    for (const side of ["beforeRuns", "afterRuns"] as const)
      result[side] = result[side].map(({ run, offset }) => ({
        offset,
        run: {
          ...run,
          rules: run.rules.map((rule) => {
            const proxy = new Proxy(rule, {
              ownKeys(target) {
                copies++;
                return Reflect.ownKeys(target);
              },
            });
            storeCssRuleData(proxy, cssRuleData(rule));
            return proxy;
          }),
        },
      }));
    assert.equal(
      inlineMaterialReplacements(result, "before").actual.appendix.match(
        /color:red/g,
      )?.length,
      count,
    );
    assert.equal(
      inlineMaterialReplacements(result, "after").actual.appendix.match(
        /color:red/g,
      )?.length,
      count,
    );
    assert.equal(copies, 0, "composition must not copy any cached rule");
  });
