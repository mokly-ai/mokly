import assert from "node:assert/strict";
import test from "node:test";

import { compareComponentView } from "../dist/review/component_view.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  assertStyleRoute,
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`style route proves complete reference-free deltas and transitive resources in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    const withResources = (before: string, after: string) => ({
      ...withHeadStyles(fixture, before, after),
      beforeFiles: new Map([
        ...withHeadStyles(fixture, before, after).beforeFiles,
        ["asset.svg", "asset"],
        ["other.svg", "other"],
        ["sheet.css", '@import "nested.css";'],
        ["nested.css", '.asset{background:url("asset.svg")}'],
      ]),
      afterFiles: new Map([
        ...withHeadStyles(fixture, before, after).afterFiles,
        ["asset.svg", "asset"],
        ["other.svg", "other"],
        ["sheet.css", '@import "nested.css";'],
        ["nested.css", '.asset{background:url("asset.svg")}'],
      ]),
    });
    const style = (text: string) => `<style>${text}</style>`;
    for (const [name, before, after, route] of [
      [
        "adjacent unchanged URL",
        '.asset{background:url("../../asset.svg")}.entry{color:red}',
        '.asset{background:url("../../asset.svg")}.entry{color:blue}',
        "style",
      ],
      [
        "unchanged owned URL",
        '.actual-only{background:url("../../asset.svg")}.entry{color:red}',
        '.actual-only{background:url("../../asset.svg")}.entry{color:blue}',
        "style",
      ],
      [
        "reference crossing window edge",
        '.entry{background:url("../../asset.svg")}',
        '.entry{background:url("../../other.svg")}',
        "complete",
      ],
      [
        "unchanged reference in changed rule",
        '.entry{background:url("../../asset.svg");color:red}',
        '.entry{background:url("../../asset.svg");color:blue}',
        "complete",
      ],
      [
        "condition prelude reference",
        '@supports(background:url("../../asset.svg")){.entry{color:red}}',
        '@supports(background:url("../../asset.svg")){.entry{color:blue}}',
        "complete",
      ],
      [
        "added reference rule",
        ".entry{color:red}",
        '.entry{color:red}.asset{background:url("../../asset.svg")}',
        "complete",
      ],
      [
        "removed reference rule",
        '.entry{color:red}.asset{background:url("../../asset.svg")}',
        ".entry{color:red}",
        "complete",
      ],
      [
        "external reference",
        '.entry{background:url("https://example.com/a.png");color:red}',
        '.entry{background:url("https://example.com/a.png");color:blue}',
        "complete",
      ],
    ] as const)
      await context.test(name, async () => {
        await assertStyleRoute(
          withResources(style(before), style(after)),
          route,
        );
      });
    const markup = (color: string) =>
      `<link rel="stylesheet" href="../../sheet.css">${style(`.entry{color:${color}}`)}`;
    const original = withResources(markup("red"), markup("blue"));
    await context.test(
      "both readers traverse stable closures once",
      async () => {
        const comparisonContext = pageContext(original);
        const readBefore =
          comparisonContext.beforeReader.resourcesIfPresent.bind(
            comparisonContext.beforeReader,
          );
        let requiredBaseCalls = 0;
        const requiredBefore = comparisonContext.beforeReader.resources.bind(
          comparisonContext.beforeReader,
        );
        comparisonContext.beforeReader.resources = (...args) => {
          requiredBaseCalls++;
          return requiredBefore(...args);
        };
        const readAfter = comparisonContext.afterReader.resources.bind(
          comparisonContext.afterReader,
        );
        let baseCalls = 0;
        let headCalls = 0;
        comparisonContext.beforeReader.resourcesIfPresent = (...args) => {
          baseCalls++;
          return readBefore(...args);
        };
        comparisonContext.afterReader.resources = (...args) => {
          headCalls++;
          return readAfter(...args);
        };
        const { before, after } = selectedStyleViews(original);
        const result = await compareComponentView(
          comparisonContext,
          before,
          after,
        );
        assert.equal(result.comparisonPath, "style");
        assert.equal(baseCalls, 1);
        assert.equal(headCalls, 1);
        assert.equal(requiredBaseCalls, 0);
      },
    );
    await context.test("changed transitive Git resource", async () => {
      await assertStyleRoute(
        {
          ...original,
          afterFiles: new Map([
            ...original.afterFiles,
            ["asset.svg", "changed"],
          ]),
          changedPaths: ["mockups/asset.svg"],
        },
        "complete",
      );
    });
    if (mode === "derived") {
      await context.test("independent transitive bytes", async () => {
        await assertStyleRoute(
          {
            ...original,
            afterFiles: new Map([
              ...original.afterFiles,
              ["asset.svg", "changed"],
            ]),
          },
          "complete",
        );
      });
      await context.test("independent closure membership", async () => {
        await assertStyleRoute(
          {
            ...original,
            beforeFiles: new Map([
              ...original.beforeFiles,
              ["nested.css", '.asset{background:url("other.svg")}'],
            ]),
          },
          "complete",
        );
      });
    }
  });
