import assert from "node:assert/strict";
import test from "node:test";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const sheet = '<style>.missing{background:url("../../x.css")}</style>';
const ignored = (value: string) =>
  `<!--mokly-review-ignore:start:clock-->${value}<!--mokly-review-ignore:end:clock-->`;

test("derived proofs fall through for a missing transitive base resource", async (context) => {
  const base = await styleRouteFixture(context);
  for (const [name, left, right, state] of [
    [
      "style route",
      sheet + "<style>.entry{color:red}</style>",
      sheet + "<style>.entry{color:blue}</style>",
      "changed",
    ],
    ["identical quick check", sheet, sheet, "unchanged"],
    [
      "non-identical quick check",
      sheet + ignored("before"),
      sheet + ignored("after"),
      "ignored-only",
    ],
  ])
    await context.test(name!, async (context) => {
      const input = withHeadStyles(base, left!, right!, "derived");
      const fixture = {
        ...input,
        beforeFiles: new Map([
          ...input.beforeFiles,
          ["x.css", '.x{background:url("y.svg")}'],
        ]),
        afterFiles: new Map([
          ...input.afterFiles,
          ["x.css", '.x{background:url("y.svg")}'],
          ["y.svg", "head only"],
        ]),
      };
      const oracle = await compareStyleSwitches(fixture, styleSwitches[0]);
      for (const switches of styleSwitches)
        await context.test(JSON.stringify(switches), async () => {
          const result = await compareStyleSwitches(fixture, switches);
          assert.deepEqual(result, oracle);
          assert.equal(result.comparisonPath, "complete");
          assert.equal(result.view.state, state);
        });
    });
});

test("derived proofs preserve a required reader's missing-file diagnostic", async (context) => {
  const base = await styleRouteFixture(context);
  for (const changed of [false, true])
    await context.test(`style text changed=${changed}`, async (context) => {
      const markup = (color: string) =>
        `<style>.entry{background:url("../../new.svg")}.entry{color:${color}}</style>`;
      const input = withHeadStyles(
        base,
        markup("red"),
        markup(changed ? "blue" : "red"),
        "derived",
      );
      const fixture = {
        ...input,
        afterFiles: new Map([...input.afterFiles, ["new.svg", "head only"]]),
      };
      for (const switches of styleSwitches)
        await context.test(JSON.stringify(switches), async () => {
          await assert.rejects(compareStyleSwitches(fixture, switches), {
            message: "Missing fixture resource: new.svg",
          });
        });
    });
});
