import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

test("a distant caller-slot wrapper ending preserves skipped style fingerprints", async (context) => {
  const style = '<style>.entry{color:red}</style data-rendered="true">';
  const fixture = await inlineChangesFixture(context, style, style, {
    colorSchemes: false,
    source: componentEntrySource({
      paneRender: "(props) => <section>{props.children}</section>",
      body: "<pane.Component><p>Caller</p></pane.Component>",
    }),
  });
  for (const mode of ["committed", "derived"] as const)
    await context.test(mode, async () => {
      const input = await pageFixtureInput(fixture, mode);
      const prepared = fingerprintMaterials(input);
      assert.equal(prepared.inlineAnalysis?.status, "skipped");
      assert.ok(
        prepared.projected.actual.base.includes("<!--mokly-inline-style:"),
      );
      assert.deepEqual(
        await fingerprintComparison(input, true),
        await fingerprintComparison(input, false),
      );
    });
});

test("marker stripping after a closing-tag name preserves delivered text bytes", async (context) => {
  const style = "<style>.entry{color:red}</style>";
  const removed =
    "<!--mokly-component:start:r-100--><!--mokly-component:end:r-100-->";
  const copy = `<textarea>${style.replace("</style>", `</style${removed}>`)}</textarea>`;
  const fixture = await inlineChangesFixture(context, "", "", {
    colorSchemes: false,
    source: componentEntrySource({ body: "<p>Ordinary</p>" }),
    renderer: {
      before: fingerprintRenderer(style, copy + "before"),
      after: fingerprintRenderer(style, copy + "after"),
    },
  });
  for (const mode of ["committed", "derived"] as const)
    await context.test(mode, async () => {
      await assertGuardedMaterials(await pageFixtureInput(fixture, mode), mode);
    });
});

test("marker removal inside an owned style cannot create an interchangeable text copy", async (context) => {
  const css = ".entry{color:red}";
  const removed =
    "<!--mokly-component:start:r-100--><!--mokly-component:end:r-100-->";
  const jsx = `<style>{${JSON.stringify(css)}}</style>`;
  const instance = '<action.Component moklyInstance="k1" label="Style" />';
  const source = (body: string) =>
    componentEntrySource({
      actionRender: `() => <style>{${JSON.stringify(css.replace("red", removed + "red"))}}</style>`,
      body,
    });
  const fixture = await inlineChangesFixture(context, "", "", {
    colorSchemes: false,
    source: source(jsx + instance),
    afterSource: source(instance + jsx),
  });
  for (const mode of ["committed", "derived"] as const)
    await context.test(mode, async () => {
      const input = await pageFixtureInput(fixture, mode);
      assert.equal(
        fingerprintMaterials(input, false).inlineAnalysis?.status,
        "skipped",
      );
      await assertGuardedMaterials(input, mode);
    });
});
