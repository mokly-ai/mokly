import assert from "node:assert/strict";
import test from "node:test";

import { serializeBlock } from "../dist/review/css/serialization.js";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  captureStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const key = "a".repeat(64);
const reference = 'background:url("../../asset.svg")';
const ignore = (text: string) =>
  `<!--mokly-review-ignore:start:other-->${text}<!--mokly-review-ignore:end:other-->`;
const spellings = ["<! --", "<!/**/--", "< !--", "</**/!--"];
const contexts = [
  ["declaration", (marker: string) => `.entry{--x:(${marker});${reference}}`],
  [
    "at-rule prelude",
    (marker: string) => `@example (${marker});.entry{${reference}}`,
  ],
  [
    "selector argument",
    (marker: string) => `.entry:foo(${marker}){${reference}}`,
  ],
  [
    "supports",
    (marker: string) => `@supports (${marker}){.entry{${reference}}` + "}",
  ],
] as const;

test("canonical declaration serialization joins the split material marker", () => {
  assert.ok(
    serializeBlock(
      `--x:<! --mokly-review-material:clock:${key}-->`,
    ).declarations.includes("<!--mokly-review-material:"),
  );
});

test("separator-split markers preserve full validation and results", async (context) => {
  const base = await styleRouteFixture(context);
  for (const prefix of spellings)
    for (const [name, css] of contexts)
      for (const identical of [true, false])
        await context.test(
          `${prefix}, ${name}, identical=${identical}`,
          async (context) => {
            const text = css(`${prefix}mokly-review-material:clock:${key}-->`);
            const input = withHeadStyles(
              base,
              `<style>${text}</style>${identical ? "" : ignore("before")}`,
              `<style>${text}</style>${identical ? "" : ignore("after")}`,
            );
            const fixture = {
              ...input,
              beforeFiles: new Map([
                ...input.beforeFiles,
                ["asset.svg", "same"],
              ]),
              afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
            };
            const oracle = await captureStyleSwitches(
              fixture,
              styleSwitches[0],
            );
            if (name === "declaration")
              assert.deepEqual(oracle, {
                kind: "error",
                name: "Error",
                message:
                  "[mokly/review-ignore] mokly-generated/home/index.mobile.html: material signal for clock has no region",
              });
            for (const switches of styleSwitches)
              await context.test(JSON.stringify(switches), async () => {
                const result = await captureStyleSwitches(fixture, switches);
                assert.deepEqual(result, oracle);
                if (result.kind === "result")
                  assert.equal(result.comparisonPath, "complete");
              });
          },
        );
  for (const prefix of spellings)
    for (const identical of [true, false])
      await context.test(
        `ignore start ${prefix}, identical=${identical}`,
        async (context) => {
          const css = `.entry{--x:(${prefix}mokly-review-ignore:start:clock-->);${reference}}`;
          const input = withHeadStyles(
            base,
            `<style>${css}</style>${identical ? "" : ignore("before")}`,
            `<style>${css}</style>${identical ? "" : ignore("after")}`,
          );
          const fixture = {
            ...input,
            beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
            afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
          };
          for (const switches of styleSwitches)
            await context.test(JSON.stringify(switches), async () => {
              assert.deepEqual(await captureStyleSwitches(fixture, switches), {
                kind: "error",
                name: "Error",
                message:
                  "[mokly/review-ignore] mokly-generated/home/index.mobile.html: region clock has no end marker",
              });
            });
        },
      );
});
