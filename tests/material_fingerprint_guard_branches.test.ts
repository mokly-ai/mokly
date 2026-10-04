import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { fingerprintMaterials } from "./helpers/fingerprint_comparison.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:x-->";
const end = "<!--mokly-review-ignore:end:x-->";
const signal = `<!--mokly-review-material:x:${"a".repeat(64)}-->`;
const style = "<style>.entry{color:red}</style>";
for (const mode of ["committed", "derived"] as const) {
  test(`single-document actual normalization protects skipped style placement: ${mode}`, async (context) => {
    const fragment = `mokly-in${start}line-style:D-->${end}`;
    const fixture = await inlineChangesFixture(
      context,
      style + fragment,
      fragment + style,
      { colorSchemes: false },
    );
    const input = await pageFixtureInput(fixture, mode);
    assert.equal(
      fingerprintMaterials(input, false).inlineAnalysis?.status,
      "skipped",
    );
    await assertGuardedMaterials(input, "single-document actual");
  });

  test(`projected one-sided signal removal protects a prefix outside its paired instance: ${mode}`, async (context) => {
    const source = (inside: string, outside: string) =>
      componentEntrySource({
        actionRender: `() => <span dangerouslySetInnerHTML={{__html: ${JSON.stringify(inside)}}} />`,
        body: `<action.Component moklyInstance="k1" label="Empty" /><span dangerouslySetInnerHTML={{__html: ${JSON.stringify(outside)}}} />`,
      });
    const fixture = await inlineChangesFixture(context, style, style, {
      colorSchemes: false,
      source: source(start + "same" + end + signal, "ordinary"),
      afterSource: source(
        "",
        `<!--mokly-in${signal}line-style:D-->${start}same${end}`,
      ),
    });
    const input = await pageFixtureInput(fixture, mode);
    assert.equal(
      fingerprintMaterials(input, false).inlineAnalysis?.status,
      "skipped",
    );
    await assertGuardedMaterials(input, "projected normalization");
  });
}
