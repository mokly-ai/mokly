import assert from "node:assert/strict";
import { test } from "node:test";

import { ComponentValidationError } from "../dist/components/data.js";
import type { ComponentRangeRecord } from "../dist/components/manifest_types.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import {
  generatedViews,
  type GeneratedComponentView,
} from "../dist/components/views.js";
import type { Manifest } from "../dist/registry/types.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import {
  compareComponentView,
  type ComponentViewContext,
} from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

const records: readonly ComponentRangeRecord[] = [
  { id: "r-0", target: { kind: "instance", instanceKey: "instance" } },
];

for (const prefix of ["mokly", "mokabook"])
  test(`historical ${prefix} ranges retain original offsets and validation`, () => {
    const start = `<!--${prefix}-component:start:r-0-->`;
    const end = `<!--${prefix}-component:end:r-0-->`;
    const html = `<html><body>😀${start}<button>Action</button>${end}<style>.a{color:red}</style></body></html>`;
    const [range] = validateComponentRanges(html, records, "historical");
    assert.ok(range);
    assert.equal(range.start, html.indexOf(start));
    assert.equal(range.end, html.indexOf(end) + end.length);
    assert.equal(
      html.slice(range.contentStart, range.contentEnd),
      "<button>Action</button>",
    );
    assert.throws(
      () =>
        validateComponentRanges(html.replace(end, ""), records, "historical"),
      /missing component boundaries/,
    );
    assert.throws(
      () =>
        validateComponentRanges(
          html.replace(start, start.replace("r-0", "bad")),
          records,
          "historical",
        ),
      /malformed component boundary/,
    );
    assert.throws(
      () =>
        validateComponentRanges(
          `<!--${prefix}-review-ignore:start:bad-->${html}<!--${prefix}-review-ignore:end:bad-->`,
          records,
          "historical",
        ),
      /ReviewIgnore cannot enclose/,
    );
    if (prefix === "mokabook")
      assert.throws(
        () => validateComponentRanges(html, records),
        /missing component boundaries/,
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
    const current = fixture.after.outputs.get(view.path);
    assert.notEqual(current, undefined);
    const document =
      side === "removed"
        ? current!.replaceAll("<!--mokly-component:", "<!--mokabook-component:")
        : current!;
    const malformed = document.replace(
      /<!--(?:mokly|mokabook)-component:end:r-0-->/,
      "",
    );

    await assert.rejects(
      compareOneSided(fixture.after.manifest, view, side, malformed),
      (error) => {
        assert.ok(error instanceof ComponentValidationError);
        assert.equal(error.path, "$document");
        assert.match(error.detail, /component boundary|component boundaries/);
        return true;
      },
    );

    const comparison = await compareOneSided(
      fixture.after.manifest,
      view,
      side,
      document,
    );
    assert.equal(comparison.comparisonPath, "complete");
    assert.equal(comparison.view.state, side);
    assert.equal(comparison.view.material, true);
    assert.deepEqual(comparison.reasons, [{ kind: "material" }]);
  });

function compareOneSided(
  manifest: Manifest,
  view: GeneratedComponentView,
  side: "added" | "removed",
  document: string,
) {
  const context = viewContext(manifest, view.path, document);
  return compareComponentView(
    context,
    side === "removed" ? view : undefined,
    side === "added" ? view : undefined,
  );
}

function viewContext(
  manifest: Manifest,
  route: string,
  document: string,
): ComponentViewContext {
  const reader = () =>
    new ComponentMaterialReader({
      read: async (requested) =>
        Buffer.from(requested === route ? document : ""),
    });
  const beforeReader = reader();
  const afterReader = reader();
  return {
    beforeReader,
    afterReader,
    dependencies: new ComponentDependencyPolicy(manifest, manifest, []),
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
