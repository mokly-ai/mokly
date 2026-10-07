import assert from "node:assert/strict";
import test from "node:test";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";

test("quick checks compare eligible style sequences", async (context) => {
  const base = await styleRouteFixture(context);
  for (const tag of ["title", "template"])
    for (const mirrored of [false, true])
      await context.test(`${tag}, mirrored=${mirrored}`, async (context) => {
        const markup = (open: boolean) =>
          `${start}${open ? `<${tag}>` : "x"}${end}<style>.entry{color:red}</style></${tag}>`;
        const fixture = withHeadStyles(
          base,
          markup(!mirrored),
          markup(mirrored),
        );
        const oracle = await compareStyleSwitches(fixture, styleSwitches[0]);
        for (const switches of styleSwitches)
          await context.test(JSON.stringify(switches), async () => {
            const result = await compareStyleSwitches(fixture, switches);
            assert.deepEqual(result, oracle);
            assert.equal(result.comparisonPath, "complete");
            assert.equal(result.view.state, "changed");
            assert.equal(result.view.material, true);
            assert.deepEqual(result.reasons, [{ kind: "material" }]);
          });
      });
});
