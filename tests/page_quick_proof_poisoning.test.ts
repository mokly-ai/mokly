import assert from "node:assert/strict";
import test from "node:test";

import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";
import { styleSwitches } from "./helpers/style_switches.js";

const needed = '.entry{background:url("../asset.svg")}';
const missing = '.missing{background:url("../m.svg")}';
const ignored = (value: string) =>
  `<!--mokly-review-ignore:start:other-->${value}<!--mokly-review-ignore:end:other-->`;

test("a failed required-only proof batch cannot poison needed files", async (context) => {
  const base = await styleRouteFixture(context);
  for (const [name, left, right, state] of [
    [
      "identical",
      `<style>${missing}${needed}</style>`,
      `<style>${missing}${needed}</style>`,
      "unchanged",
    ],
    [
      "non-identical",
      `<style>${missing}${needed}</style>${ignored("before")}`,
      `<style>${missing}${needed}</style>${ignored("after")}`,
      "ignored-only",
    ],
    [
      "link",
      `<style>${missing}</style><link rel="stylesheet" href="../sheet.css">`,
      `<style>${missing}</style><link rel="stylesheet" href="../sheet.css">`,
      "unchanged",
    ],
    [
      "style route",
      `<style>${missing}${needed}.entry{color:red}</style>`,
      `<style>${missing}${needed}.entry{color:blue}</style>`,
      "changed",
    ],
  ])
    await context.test(name!, async (context) => {
      const input = withHeadStyles(base, left!, right!, "derived");
      const beforeFiles = new Map([
        ...input.beforeFiles,
        ["asset.svg", "same"],
        ["sheet.css", '.entry{background:url("asset.svg")}'],
      ]);
      const fixture = {
        ...input,
        beforeFiles,
        afterFiles: new Map([
          ...input.afterFiles,
          ["asset.svg", "same"],
          ["sheet.css", '.entry{background:url("asset.svg")}'],
          ["m.svg", "head only"],
        ]),
      };
      const { before, after } = selectedStyleViews(fixture);
      const compare = async (switches: (typeof styleSwitches)[number]) => {
        const existing = pageContext(fixture);
        const bytes = (route: string) => {
          const value = beforeFiles.get(route);
          if (value === undefined) throw new Error(`single missing ${route}`);
          return Buffer.from(value);
        };
        const beforeReader = new ComponentMaterialReader({
          read: async (route) => bytes(route),
          readMany: async (routes) => {
            const absent = routes.find((route) => !beforeFiles.has(route));
            if (absent) throw new Error(`batch missing ${absent}`);
            return new Map(routes.map((route) => [route, bytes(route)]));
          },
        });
        return compareComponentView(
          {
            ...existing,
            ...switches,
            beforeReader,
            resources: new ResourceComparison(
              beforeReader,
              existing.afterReader,
              existing.changed,
              existing.prefix,
              undefined,
              undefined,
              true,
            ),
          },
          before,
          after,
        );
      };
      const oracle = await compare(styleSwitches[0]);
      assert.equal(oracle.view.state, state);
      assert.equal(oracle.comparisonPath, "complete");
      for (const switches of styleSwitches)
        await context.test(JSON.stringify(switches), async () => {
          assert.deepEqual(await compare(switches), oracle);
        });
    });
});
