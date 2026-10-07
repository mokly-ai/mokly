import assert from "node:assert/strict";
import test from "node:test";

import { cssRuleData } from "../dist/review/css/rule_identity.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const style = (css: string) => `<style>${css}</style>`;
const plain = '.entry:is([title=""],main){color:red}';
const escaped = String.raw`.entry:is([title="\3c !--mokly-component:start:r-10-->"],main){color:red}`;

test("independent reserved-prefix guards", async (context) => {
  const fixture = await styleRouteFixture(context);
  for (const [name, before, after] of [
    [
      "edited comment only in original content",
      style("/*<!--mokly-component:start:r-10-->*/.entry{color:red}"),
      style("/*<!--mokly-component:start:r-20-->*/.entry{color:red}"),
    ],
    [
      "excluded rule only in original content",
      style('.missing{content:"<!--mokly-component:start:r-10-->"}'),
      style('.missing{content:"<!--mokly-component:start:r-20-->"}'),
    ],
    [
      "unchanged comment only in original content",
      style("/*<!--mokly-inline-rules:unchanged-->*/") +
        style(".entry{color:red}"),
      style("/*<!--mokly-inline-rules:unchanged-->*/") +
        style(".entry{color:blue}"),
    ],
    ["head-only composed prefix", style(plain), style(escaped)],
    ["base-only composed prefix", style(escaped), style(plain)],
  ])
    await context.test(name!, async () => {
      if (name!.includes("composed")) {
        for (const css of [plain, escaped]) {
          assert.ok(!css.includes("<!--mokly-"));
          const parsed = new LightningCssRuleParser().parse(css);
          assert.equal(parsed.status, "parsed");
          if (parsed.status === "parsed")
            assert.equal(
              parsed.rules.some((rule) =>
                cssRuleData(rule).canonicalText.includes("<!--mokly-"),
              ),
              css === escaped,
            );
        }
      }
      await assertStyleRoute(
        withHeadStyles(fixture, before!, after!),
        "complete",
      );
    });
});
