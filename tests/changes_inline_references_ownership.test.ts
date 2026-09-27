import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { ReviewResultV3 } from "../packages/viewer/dist/review/component_types.js";

import {
  inlineChangesFixture,
  inlineComponentSource,
} from "./helpers/inline_changes.js";

const ownedRule = '<style>.actual-only{background:url("../image.svg")}</style>';

function imageFiles() {
  return {
    before: {
      "image.svg": "before-image",
      "components/image.svg": "component-image",
    },
    after: {
      "image.svg": "after-image",
      "components/image.svg": "component-image",
    },
  };
}

async function resultFor(
  t: TestContext,
  styles: string,
  options: Parameters<typeof inlineChangesFixture>[3] = {},
): Promise<ReviewResultV3> {
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: imageFiles(),
    ...options,
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 3);
  assert.ok(result.schemaVersion === 3);
  return result;
}

function change(result: ReviewResultV3, route: string) {
  return result.changes.find(
    (entry) => (entry.after ?? entry.before)?.route === route,
  );
}

test("an image reached only by an owned inline rule belongs to its component", async (t) => {
  const fixture = await inlineChangesFixture(t, ownedRule, ownedRule, {
    files: imageFiles(),
  });
  const [live, artifact] = await Promise.all([
    fixture.live(),
    fixture.complete(),
  ]);
  assert.equal(artifact.result.schemaVersion, 3);
  if (artifact.result.schemaVersion !== 3) return;
  assert.deepEqual(live.changedRoutes, ["components/action.html"]);
  assert.deepEqual(
    artifact.result.changes.map((entry) => entry.after?.route),
    ["components/action.html"],
  );
  assert.deepEqual(change(artifact.result, "components/action.html")?.reasons, [
    { kind: "dependency", path: "mockups/image.svg" },
  ]);
  assert.ok(
    artifact.result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" &&
        item.consumer.kind === "screen" &&
        item.consumer.route === "screens/home.html",
    ),
  );
});

test("an unrelated entry edit keeps material without claiming the owned image", async (t) => {
  const result = await resultFor(t, ownedRule, {
    afterSource: inlineComponentSource().replace(
      "Screen content",
      "Changed screen content",
    ),
  });
  assert.deepEqual(change(result, "components/action.html")?.reasons, [
    { kind: "dependency", path: "mockups/image.svg" },
  ]);
  assert.deepEqual(change(result, "screens/home.html")?.reasons, [
    { kind: "material" },
  ]);
});

test("entry markup independently referencing an owned image keeps both rows", async (t) => {
  const source = inlineComponentSource().replace(
    '<main className="entry">',
    '<main className="entry"><img src="../image.svg" />',
  );
  const result = await resultFor(t, ownedRule, { source });
  for (const route of ["components/action.html", "screens/home.html"])
    assert.deepEqual(change(result, route)?.reasons, [
      { kind: "dependency", path: "mockups/image.svg" },
    ]);
});

test("a background image in a nested-parent rule follows the nested owner", async (t) => {
  const result = await resultFor(
    t,
    '<style>.entry{& .actual-only{background:url("../image.svg")}}</style>',
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.route),
    ["components/action.html"],
  );
});

test("one referenced image can belong to two matched components", async (t) => {
  const styles = '<style>.shared{background:url("../image.svg")}</style>';
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: imageFiles(),
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.route),
    ["components/action.html", "components/pane.html"],
  );
  for (const id of ["action", "pane"])
    assert.deepEqual(
      result.changes.find((entry) => entry.after?.id === id)?.reasons,
      [{ kind: "dependency", path: "mockups/image.svg" }],
    );
});

test("inferred and declarative owners are unioned for one resource", async (t) => {
  const source = inlineComponentSource().replace(
    'id: "pane",',
    'id: "pane", dependencies: ["mockups/image.svg"], ownedDependencies: ["mockups/image.svg"],',
  );
  const result = await resultFor(t, ownedRule, { source });
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.route),
    ["components/action.html", "components/pane.html"],
  );
  for (const id of ["action", "pane"])
    assert.deepEqual(
      result.changes.find((entry) => entry.after?.id === id)?.reasons,
      [{ kind: "dependency", path: "mockups/image.svg" }],
    );
});

test("transitive inline resources retain the rule owner's repository path", async (t) => {
  const styles = '<style>.actual-only{background:url("../owned.css")}</style>';
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: {
      before: {
        "owned.css": '@import "nested.css";',
        "nested.css": '.asset{background:url("deep.svg")}',
        "deep.svg": "before-image",
        "components/owned.css": "",
      },
      after: {
        "owned.css": '@import "nested.css";',
        "nested.css": '.asset{background:url("deep.svg")}',
        "deep.svg": "after-image",
        "components/owned.css": "",
      },
    },
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(change(result, "components/action.html")?.reasons, [
    { kind: "dependency", path: "mockups/deep.svg" },
  ]);
  assert.equal(change(result, "screens/home.html"), undefined);
});
