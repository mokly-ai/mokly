import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

test("view-wide grouped/nested displacement remains the same on the route", async (context) => {
  const fixture = await styleRouteFixture(context);
  for (const nesting of [false, true])
    for (const material of ["plain", "custom", "url"] as const)
      for (const wholeFallback of [false, true])
        await context.test(
          `${nesting ? "nested" : "grouped"}/${material}/whole=${wholeFallback}`,
          async () => {
            const wrap = (rules: string) =>
              nesting ? `.entry{${rules}}` : `@media screen{${rules}}`;
            const declaration = (color: string) =>
              material === "custom"
                ? `--tone:${color};color:${color}`
                : material === "url"
                  ? `background:url("../../${color}.svg")`
                  : `color:${color}`;
            const single = (color: string, outputColor = color) =>
              wrap(
                `.actual-only{${declaration(color).replace(`color:${color}`, `color:${outputColor}`)}}`,
              );
            const group = wrap(
              `.actual-only{${declaration("red")}}.missing{color:black}`,
            );
            const prefix = `<style>${single("red")}</style>`;
            const suffix = wholeFallback
              ? '<style>@charset "UTF-8";</style>'
              : "<style>.other{color:orange}</style>";
            const input = withHeadStyles(
              fixture,
              `${prefix}<style>${single("red")}${single("blue")}${group}</style>${suffix}`,
              `${prefix}<style>${group}${single(material === "custom" ? "blue" : "green", "green")}</style>${suffix}`,
            );
            const resources = ["red", "blue", "green"].map(
              (color) => [`${color}.svg`, color] as const,
            );
            const { comparison, counts } = await assertStyleRoute(
              {
                ...input,
                beforeFiles: new Map([...input.beforeFiles, ...resources]),
                afterFiles: new Map([...input.afterFiles, ...resources]),
              },
              material === "url" ? "complete" : "style",
            );
            if (material === "custom") {
              assert.deepEqual(
                [...comparison.changedImplementations],
                wholeFallback ? ["action"] : [],
              );
              assert.equal(comparison.view.inlineStyles?.status, "unresolved");
            }
            assert.equal(counts("review.inline-style-analysis").elements, 6);
          },
        );
});
