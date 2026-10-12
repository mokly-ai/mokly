import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const style = "<style>.entry{color:red}</style>";
const digest = createHash("sha256").update(style).digest("base64url");
const region = (id: string, text: string) =>
  `<!--mokly-review-ignore:start:${id}-->${text}<!--mokly-review-ignore:end:${id}-->`;
const signal = (id: string) =>
  `<!--mokly-review-material:${id}:${"a".repeat(64)}-->`;
const source = (head: boolean) =>
  componentEntrySource({
    actionRender: "() => null",
    body: `<main className="entry">${head ? "" : "STYLE"}{"<"}<action.Component moklyInstance="first" label="Empty" />{"!--mokly-in<"}<action.Component moklyInstance="second" label="Empty" />{"!--mokly-review-mate"}{"REGION_Z"}{"line-style:${digest}-->"}${head ? "STYLE" : ""}REGIONS SIGNALS</main>`,
  });
const renderer = (
  head: boolean,
) => `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head></head><body>' + renderToStaticMarkup(input.node)
.replaceAll('&lt;', '<').replaceAll('&gt;', '>')
.replace('STYLE', ${JSON.stringify(style)})
.replace('REGION_Z', ${JSON.stringify(region("z", `rial:${head ? "x" : "y"}:${"a".repeat(64)}-->`))})
.replace('REGIONS', ${JSON.stringify(region("x", "X") + region("y", "Y"))})
.replace('SIGNALS', ${JSON.stringify(head ? signal("y") : signal("x") + signal("z"))}) + '</body></html>';`;

for (const mode of ["committed", "derived"] as const)
  test(`real empty instances can create nested normalization markers: ${mode}`, async (context) => {
    const fixture = await inlineChangesFixture(context, "", "", {
      source: source(false),
      afterSource: source(true),
      colorSchemes: false,
      renderer: { before: renderer(false), after: renderer(true) },
    });
    const input = await pageFixtureInput(fixture, mode);
    const text = await fingerprintComparison(input, false);
    assert.equal(text.kind, "result");
    if (text.kind === "result") {
      assert.equal(text.result.view.state, "changed");
      assert.equal(text.result.view.material, true);
    }
    await assertGuardedMaterials(input, "real empty instances");
  });
