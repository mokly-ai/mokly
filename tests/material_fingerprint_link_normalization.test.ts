import assert from "node:assert/strict";
import test from "node:test";

import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

test("fingerprints retain text-oracle equality after resource URL normalization", async (t) => {
  const original = withHeadStyles(
    await styleRouteFixture(t),
    '<style>.entry{background:url("../../asset.svg")}</style>',
    '<style>.entry{background:url("../.././asset.svg")}</style>',
  );
  const fixture = {
    ...original,
    beforeFiles: new Map([...original.beforeFiles, ["asset.svg", "image"]]),
    afterFiles: new Map([...original.afterFiles, ["asset.svg", "image"]]),
  };
  const { before, after } = selectedStyleViews(fixture);
  const links = catalogueLinkNormalizer(
    fixture.before.entries,
    fixture.after.entries,
    [],
  );
  const context = () => ({ ...pageContext(fixture), links });
  const base = Buffer.from(fixture.beforeFiles.get(before.path)!).toString();
  const head = Buffer.from(fixture.afterFiles.get(after.path)!).toString();
  const text = prepareComponentProjection(
    { ...context(), useMaterialFingerprints: false },
    before,
    after,
    base,
    head,
  );
  const fingerprint = prepareComponentProjection(
    context(),
    before,
    after,
    base,
    head,
  );
  assert.equal(text.projected.actual.base, text.projected.actual.head);
  assert.deepEqual(fingerprint.references, text.references);
  assert.deepEqual(fingerprint.projected, text.projected);
  for (const useFastPath of [false, true])
    for (const useStylePath of [false, true]) {
      const switches = { useFastPath, useStylePath };
      const oracle = await compareComponentView(
        { ...context(), ...switches, useMaterialFingerprints: false },
        before,
        after,
      );
      const result = await compareComponentView(
        { ...context(), ...switches },
        before,
        after,
      );
      assert.deepEqual(result, oracle, JSON.stringify(switches));
    }
});
