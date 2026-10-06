import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";
import type { DependencyReason } from "../packages/viewer/dist/data.js";

import {
  changedEntryPaths,
  reasonsOf,
  stylesheetScope,
} from "./helpers/attribution_result.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import {
  sharedDesignStylesheets,
  sharedStylesheetMarker,
} from "./helpers/design_stylesheets.js";
import { fileFixture } from "./helpers/file_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const sharedFixture = fileFixture((owner) => designLibraryFixture(owner));

test("mixed component design styles retain their actual rendered resource scope in one pass", async () => {
  const fixture = await sharedFixture();
  await fixture.reset();
  for (const [stylesheet] of sharedDesignStylesheets)
    await fixture.edit(
      `examples/basic/generated/${stylesheet}`,
      (source) => source + sharedStylesheetMarker,
    );
  const result = await fixture.compare();
  const scopes = new Map<string, string[]>();
  for (const [stylesheet, screens, components] of sharedDesignStylesheets) {
    const expected = fixture.before.manifest.entries.filter((entry) =>
      generatedViews(entry).some((view) => {
        const output = textOutput(fixture.before.outputs, view.path);
        assert.ok(output !== undefined, view.path);
        return output.includes(`/${stylesheet}"`);
      }),
    );
    const expectedScreens = expected.filter((entry) => entry.kind === "screen");
    if (screens === "all-design") {
      const allDesignScreens = fixture.before.manifest.entries.filter(
        (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
      );
      assert.deepEqual(
        expectedScreens.map(({ path }) => path).sort(),
        allDesignScreens.map(({ path }) => path).sort(),
        stylesheet,
      );
    } else assert.equal(expectedScreens.length, screens, stylesheet);
    assert.equal(
      expected.filter((entry) => entry.kind === "component").length,
      components,
      stylesheet,
    );
    const paths = expected.map(({ path }) => path).sort();
    assert.deepEqual(
      stylesheetScope(result, `examples/basic/generated/${stylesheet}`),
      paths,
      stylesheet,
    );
    scopes.set(stylesheet, paths);
    if (stylesheet !== "design.css")
      assert.deepEqual(
        paths.filter((path) => !path.startsWith("design/")),
        [],
        `${stylesheet}: unrelated Example content stays unchanged`,
      );
  }
  const paths = changedEntryPaths(result);
  assert.deepEqual(paths, [...new Set([...scopes.values()].flat())].sort());
  for (const path of paths) {
    const expectedReasons = [...scopes]
      .filter(([, scope]) => scope.includes(path))
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([stylesheet]): DependencyReason => ({
        kind: "dependency",
        path: `examples/basic/generated/${stylesheet}`,
        analysis: { status: "unresolved", selectors: ["body"] },
      }));
    assert.deepEqual(reasonsOf(result, path), expectedReasons, path);
  }
  const designCssScope = scopes.get("design.css");
  assert.ok(designCssScope);
  assert.deepEqual(
    paths.filter(
      (path) => !designCssScope.includes(path) && !path.startsWith("design/"),
    ),
    [],
    "changes outside design.css's scope stay under design/",
  );
  assert.deepEqual(result.sharedImpact, [
    "examples/basic/generated/design.css",
  ]);
  assert.deepEqual(result.affectedConsumers, []);
});
