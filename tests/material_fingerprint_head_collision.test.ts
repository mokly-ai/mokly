import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
import { selectedStyleViews } from "./helpers/style_route.js";

const style = "<style>.entry{color:red}</style>";
const digest = createHash("sha256").update(style).digest("base64url");
const key = "a".repeat(64);
const region = (id: string, content: string) =>
  `<!--mokly-review-ignore:start:${id}-->${content}<!--mokly-review-ignore:end:${id}-->`;
const signal = (id: string) => `<!--mokly-review-material:${id}:${key}-->`;
const fragment = `<!--mokly-in<!--mokly-review-mate${region("z", `rial:y:${key}-->`)}line-style:${digest}-->`;
const baseRegions = region("x", "X") + region("y", "Y") + region("z", "");
const headRegions = region("x", style) + region("y", "Y");
const signals = signal("y") + signal("z");
const removed = "<!--mokly-component:start:r-999-->";
const source = componentEntrySource({
  actionRender: "() => null",
  body: '<main className="entry">{"STYLE"}{"REGIONS"}{"BEFORE_JOIN"}<action.Component moklyInstance="join" label="Empty" />{"AFTER_JOIN"}{"SIGNALS"}</main>',
});
const emptyRenderer = (
  head: boolean,
) => `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head></head><body>' + renderToStaticMarkup(input.node)
.replace('STYLE', ${JSON.stringify(head ? fragment : style)})
.replace('REGIONS', ${JSON.stringify(head ? headRegions : baseRegions)})
.replace('BEFORE_JOIN', ${JSON.stringify(head ? "<" : signal("x"))})
.replace('AFTER_JOIN', ${JSON.stringify(head ? `!--mokly-review-material:x:${key}-->` : "")})
.replace('SIGNALS', ${JSON.stringify(head ? "" : signals)}) + '</body></html>';`;

for (const mode of ["committed", "derived"] as const)
  for (const realInstance of [false, true])
    test(`head-only collision through ${realInstance ? "a real empty instance" : "nested marker fragments"}: ${mode}`, async (context) => {
      const beforeHead =
        style +
        baseRegions +
        `<textarea>${signal("x")}${removed}</textarea>` +
        signals;
      const afterHead =
        fragment +
        headRegions +
        `<textarea><${removed}!--mokly-review-material:x:${key}--></textarea>`;
      const fixture = await inlineChangesFixture(context, "", "", {
        colorSchemes: false,
        ...(realInstance ? { source } : {}),
        renderer: realInstance
          ? { before: emptyRenderer(false), after: emptyRenderer(true) }
          : {
              before: fingerprintRenderer(beforeHead),
              after: fingerprintRenderer(afterHead),
            },
      });
      const input = await pageFixtureInput(fixture, mode);
      const views = selectedStyleViews(input);
      for (const original of [
        input.beforeFiles.get(views.before.path)!,
        input.afterFiles.get(views.after.path)!,
      ])
        assert.ok(!Buffer.from(original).toString().includes("mokly-inline-"));
      const materials = fingerprintMaterials(input, false);
      assert.equal(materials.inlineAnalysis?.status, "skipped");
      assert.ok(!materials.projected.actual.base.includes("mokly-inline-"));
      assert.ok(
        materials.projected.actual.head.includes(
          `<!--mokly-inline-style:${digest}-->`,
        ),
      );
      const text = await fingerprintComparison(input, false);
      assert.equal(text.kind, "result");
      if (text.kind === "result") {
        assert.equal(text.result.view.state, "changed");
        assert.equal(text.result.view.material, true);
      }
      await assertGuardedMaterials(input, "head-only authored fingerprint");
    });
