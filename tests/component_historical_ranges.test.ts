import assert from "node:assert/strict";
import { test } from "node:test";

import { ComponentValidationError } from "@mokly/viewer/data";

import { validateComponentRanges } from "../dist/components/ranges.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import type { ComponentViewContext } from "../dist/review/component_view_types.js";
import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import type { ComponentRangeRecord } from "../packages/viewer/dist/components/manifest_types.js";
import {
  generatedViews,
  type GeneratedComponentView,
} from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const records: readonly ComponentRangeRecord[] = [
  { id: "r-0", target: { kind: "instance", instanceKey: "instance" } },
];

test("normalized baseline ranges retain original offsets and validation", () => {
  const start = "<!--mokly-component:start:r-0-->";
  const end = "<!--mokly-component:end:r-0-->";
  const html = `<html><body>😀${start}<button>Action</button>${end}<style>.a{color:red}</style></body></html>`;
  const [range] = validateComponentRanges(html, records);
  assert.ok(range);
  assert.equal(range.start, html.indexOf(start));
  assert.equal(range.end, html.indexOf(end) + end.length);
  assert.equal(
    html.slice(range.contentStart, range.contentEnd),
    "<button>Action</button>",
  );
  assert.throws(
    () => validateComponentRanges(html.replace(end, ""), records),
    /missing component boundaries/,
  );
  assert.throws(
    () =>
      validateComponentRanges(
        html.replace(start, start.replace("r-0", "bad")),
        records,
      ),
    /malformed component boundary/,
  );
  assert.throws(
    () =>
      validateComponentRanges(
        `<!--mokly-review-ignore:start:bad-->${html}<!--mokly-review-ignore:end:bad-->`,
        records,
      ),
    /ReviewIgnore cannot enclose/,
  );
});

for (const side of ["added", "removed"] as const)
  test(`${side} views validate their one-sided ownership ranges`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const screen = fixture.after.manifest.entries.find(
      (entry) => entry.kind === "screen",
    );
    assert.ok(screen);
    const view = generatedViews(screen)[0];
    assert.ok(view?.usage?.ranges.length);
    const current = textOutput(fixture.after.outputs, view.path);
    assert.notEqual(current, undefined);
    const document = current!;
    const malformed = document.replace(/<!--mokly-component:end:r-0-->/, "");

    await assert.rejects(compareOneSided(view, side, malformed), (error) => {
      assert.ok(error instanceof ComponentValidationError);
      assert.equal(error.path, "$document");
      assert.match(error.detail, /component boundary|component boundaries/);
      return true;
    });

    const comparison = await compareOneSided(view, side, document);
    assert.equal(comparison.comparisonPath, "complete");
    assert.equal(comparison.view.state, side);
    assert.equal(comparison.view.material, true);
    assert.deepEqual(comparison.reasons, [{ kind: "material" }]);
  });

function compareOneSided(
  view: GeneratedComponentView,
  side: "added" | "removed",
  document: string,
) {
  const context = viewContext(view.path, document);
  return compareComponentView(
    context,
    side === "removed" ? view : undefined,
    side === "added" ? view : undefined,
  );
}

function viewContext(route: string, document: string): ComponentViewContext {
  const reader = () =>
    new ComponentMaterialReader({
      read: async (requested) =>
        Buffer.from(requested === route ? document : ""),
    });
  const beforeReader = reader();
  const afterReader = reader();
  return {
    componentAware: true,
    links: catalogueLinkNormalizer([], [], []),
    beforeReader,
    afterReader,
    changed: new Set(),
    prefix: "mockups",
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      new Set(),
      "mockups",
    ),
  };
}
