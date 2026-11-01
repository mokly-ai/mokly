import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ShellCatalogueScreen,
  ShellCatalogueReadModel,
} from "../src/catalogue/scoped_types.js";
import type { ViewEvidence } from "../src/catalogue/types.js";
import { viewEvidenceReasons } from "../src/review/view_evidence.js";

import {
  heldDetails,
  indexFixture,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

function screen(model: ShellCatalogueReadModel, path: string) {
  return model.screens.find((entry) => entry.path === path)!;
}

test("a view without a held detail carries omitted usage and its document key", () => {
  const index = indexFixture();
  const model = shellModelFixture(index, new Map());
  for (const entry of [...model.screens, ...model.components])
    for (const [at, view] of entry.views.entries()) {
      assert.deepEqual(view.usage, { status: "omitted" });
      assert.equal(view.resourceEvidence, undefined);
      const indexed = [...index.screens, ...index.components].find(
        (candidate) => candidate.path === entry.path,
      )!;
      assert.equal(view.documentKey, indexed.views[at]!.documentKey);
    }
  assert.equal(model.details.size, 0);
});

test("a held detail supplies only its own entry's views", () => {
  const model = shellModelFixture(indexFixture(), heldDetails([HOME]));
  const home = screen(model, HOME);
  const detail = model.details.get(`current:${HOME}`)!;
  assert.deepEqual(
    home.views.map((view) => view.usage),
    detail.views.map((view) => view.usage),
  );
  for (const path of ["product/browse/details", "product/browse/home/empty"])
    assert.ok(
      screen(model, path).views.every(
        (view) => view.usage.status === "omitted",
      ),
    );
  assert.ok(
    model.components.every((component) =>
      component.views.every((view) => view.usage.status === "omitted"),
    ),
  );
});

test("a page takes its evidence and a removed entry its generation's detail", () => {
  const model = shellModelFixture(
    indexFixture(),
    heldDetails(["guide", "product/browse/home/retired"]),
  );
  assert.deepEqual(
    model.pages[0]!.resourceEvidence,
    model.details.get("current:guide")!.resourceEvidence,
  );
  const removed = model.removedEntries.find(
    (record) => record.snapshotId === RETIRED,
  )!;
  assert.equal(removed.entry.kind, "screen");
  assert.ok(
    (removed.entry as ShellCatalogueScreen).views.every(
      (view) => view.usage.status !== "omitted",
    ),
  );
});

test("evidence records map to files, selectors and exclusions", () => {
  const evidence: ViewEvidence = {
    rules: [
      {
        stylesheet: "styles/page.css",
        selector: ".hero",
        status: "matched",
        owner: { kind: "entry" },
      },
      {
        stylesheet: "styles/page.css",
        selector: ".action",
        status: "matched",
        owner: { kind: "component", path: "components/action" },
      },
      {
        stylesheet: "styles/unused.css",
        selector: ".gone",
        status: "excluded",
        owner: { kind: "entry" },
      },
      {
        stylesheet: "styles/theme.css",
        selector: ".unknown",
        status: "unresolved",
        owner: { kind: "entry" },
      },
    ],
    resources: [
      { path: "assets/logo.svg", owner: { kind: "entry" } },
      { path: "styles/page.css", owner: { kind: "entry" } },
    ],
  };
  const result = viewEvidenceReasons(evidence);
  assert.deepEqual(result.excludedResources, [
    { path: "styles/unused.css", reason: "no-matching-rule" },
  ]);
  assert.deepEqual(
    result.reasons?.map((reason) => reason.path),
    ["styles/page.css", "styles/theme.css", "assets/logo.svg"],
  );
  const page = result.reasons![0]!;
  assert.equal(page.kind, "dependency");
  assert.deepEqual(page.analysis?.selectors, [".action", ".hero"]);
  assert.deepEqual(page.analysis?.pageEvidence, { selectors: [".hero"] });
  assert.deepEqual(
    page.analysis?.rules.find((rule) => rule.selectors[0] === ".action")
      ?.changedComponentPaths,
    ["components/action"],
  );
  assert.equal(result.reasons![1]!.analysis?.status, "unresolved");
  assert.equal(result.reasons![2]!.analysis, undefined);
  assert.deepEqual(viewEvidenceReasons({ rules: [], resources: [] }), {});
});
