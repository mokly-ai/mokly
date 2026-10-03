import assert from "node:assert/strict";
import test from "node:test";

import { cssRuleData } from "../dist/review/css/rule_identity.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const marker = (id: string) =>
  `.entry{content:"<!--mokly-component:start:r-${id}-->"}`;
const ignored =
  "<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->";
const escaped = (id: string) =>
  String.raw`.entry:is([title="\3c !--mokly-component:start:r-${id}-->"],main){color:red}`;

for (const mode of ["committed", "derived"] as const)
  test(`reserved style markers take the complete path in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    const style = (css: string) => `<style>${css}</style>`;
    const cases = [
      ["component marker", marker("10"), marker("20")],
      [
        "review-ignore lookalike",
        `.entry{content:"${ignored}";color:red}`,
        `.entry{content:"${ignored}";color:blue}`,
      ],
      [
        "material-signal lookalike",
        `.entry{content:"<!--mokly-review-material:clock:${"a".repeat(64)}-->${ignored}";color:red}`,
        `.entry{content:"<!--mokly-review-material:clock:${"a".repeat(64)}-->${ignored}";color:blue}`,
      ],
      ["serialized marker", escaped("10"), escaped("20")],
      [
        "inline fingerprint lookalike",
        '.entry{content:"<!--mokly-inline-rules:before-->"}',
        '.entry{content:"<!--mokly-inline-rules:after-->"}',
      ],
      [
        "future reserved marker",
        '.entry{content:"<!--mokly-future:before-->"}',
        '.entry{content:"<!--mokly-future:after-->"}',
      ],
    ] as const;
    for (const [name, before, after] of cases)
      await context.test(name, async () => {
        if (name === "serialized marker") {
          assert.ok(!before.includes("<!--mokly-"));
          assert.ok(!after.includes("<!--mokly-"));
          for (const text of [before, after]) {
            const parsed = new LightningCssRuleParser().parse(text);
            assert.ok(parsed.status === "parsed");
            assert.ok(
              parsed.rules.some((rule) =>
                cssRuleData(rule).canonicalText.includes("<!--mokly-"),
              ),
            );
          }
        }
        await assertStyleRoute(
          withHeadStyles(fixture, style(before), style(after), mode),
          "complete",
        );
      });
    await context.test(
      "lookalike in an unchanged eligible element",
      async () => {
        await assertStyleRoute(
          withHeadStyles(
            fixture,
            style(".entry{color:red}") + style(marker("10")),
            style(".entry{color:blue}") + style(marker("10")),
            mode,
          ),
          "complete",
        );
      },
    );
    await context.test("ordinary mokly text remains eligible", async () => {
      await assertStyleRoute(
        withHeadStyles(
          fixture,
          style('.entry{content:"mokly-component:start:r-10";color:red}'),
          style('.entry{content:"mokly-component:start:r-10";color:blue}'),
          mode,
        ),
        "style",
      );
    });
  });
