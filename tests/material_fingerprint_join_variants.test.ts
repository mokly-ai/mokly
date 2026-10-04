import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  assertFingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
const style = "<style>.entry{color:red}</style>";

for (const mode of ["committed", "derived"] as const)
  test(`normalization join variants retain text materials in ${mode}`, async (context) => {
    const cases = [
      [
        "material signal",
        `${style}mokly-in${signal}line-style:D-->${start}same${end}`,
        `${style}ordinary${start}same${end}`,
      ],
      [
        "eligible style",
        `mokly-in${style}line-style:D-->`,
        `mokly-in${style.replace("red", "blue")}line-style:D-->`,
      ],
      [
        "several removals",
        `${style}mok${signal}ly-in${start}line-${end}`,
        `${style}ordinary${start}line-${end}`,
      ],
    ] as const;
    for (const [name, before, after] of cases)
      await context.test(name, async () => {
        assert.ok(
          !before.includes("mokly-inline-") && !after.includes("mokly-inline-"),
        );
        const fixture = await inlineChangesFixture(context, before, after, {
          colorSchemes: false,
        });
        const input = await pageFixtureInput(fixture, mode);
        assert.deepEqual(
          fingerprintMaterials(input).projected,
          fingerprintMaterials(input, false).projected,
        );
        await assertFingerprintComparison(input);
      });
    await context.test("component marker stripping", async () => {
      const fixture = await styleRouteFixture(
        context,
        (source) => source,
        componentEntrySource({
          actionRender: "() => null",
          body: '<main className="entry">mokly-in<action.Component label="Empty" />line-style:D</main>',
        }),
      );
      const input = withHeadStyles(
        fixture,
        style,
        style.replace("red", "blue"),
        mode,
      );
      assert.deepEqual(
        fingerprintMaterials(input).projected,
        fingerprintMaterials(input, false).projected,
      );
      await assertFingerprintComparison(input);
    });
    await context.test(
      "caller-slot copy retains its marker normalization",
      async () => {
        const source = componentEntrySource({
          body: `<main className="entry"><pane.Component><style media="screen" dangerouslySetInnerHTML={{__html: '.x{content:"mokly-in<!--mokly-component:start:r-999-->line-style:D-->"}'}} /></pane.Component></main>`,
        });
        const fixture = await styleRouteFixture(
          context,
          (value) => value,
          source,
        );
        const input = withHeadStyles(
          fixture,
          style,
          style.replace("red", "blue"),
          mode,
        );
        const text = fingerprintMaterials(input, false);
        assert.ok(text.projected.before.includes("<mokly-caller-slot"));
        assert.ok(text.projected.before.includes("mokly-inline-style:D-->"));
        assert.deepEqual(fingerprintMaterials(input).projected, text.projected);
        await assertFingerprintComparison(input);
      },
    );
  });
