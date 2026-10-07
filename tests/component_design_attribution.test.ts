import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  changedEntryPaths,
  reasonsOf,
  stylesheetScope,
} from "./helpers/attribution_result.js";
import { componentVariants } from "./helpers/component_views.js";
import { resourceReasonSummaries } from "./helpers/css_evidence.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import {
  sharedDesignStylesheets,
  sharedStylesheetMarker,
  sharedStylesheetPath,
} from "./helpers/design_stylesheets.js";
import { fileFixture } from "./helpers/file_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const sharedFixture = fileFixture((owner) => designLibraryFixture(owner));

test("declared library CSS records only rendered declaring components in provenance", async (t) => {
  const fixture = await designLibraryFixture(t);
  const stylesheet = "design-library/chrome/top-bar.css";
  const owner = {
    path: stylesheet,
    componentIds: ["design/library/chrome/top-bar"],
  };
  const component = fixture.before.manifest.entries.find(
    (entry) => entry.path === "design/library/chrome/top-bar",
  );
  assert.ok(component?.kind === "component");
  const rootLink = componentVariants(
    fixture.before.manifest,
    component.path,
  )[0]!.componentViews[0]!.insertedStylesheets!.find(
    (resource) => resource.path === stylesheet,
  );
  assert.deepEqual(
    rootLink && { path: rootLink.path, componentIds: rootLink.componentPaths },
    owner,
  );
  let consumers = 0;
  for (const entry of fixture.before.manifest.entries) {
    if (entry.kind !== "screen") continue;
    for (const view of entry.componentViews ?? []) {
      const rendersTopBar = view.instances.some(
        (instance) => instance.componentId === component.path,
      );
      const resource = view.insertedStylesheets?.find(
        (record) => record.path === stylesheet,
      );
      if (rendersTopBar) {
        assert.deepEqual(
          resource && {
            path: resource.path,
            componentIds: resource.componentPaths,
          },
          owner,
        );
        assert.deepEqual(view.resources, []);
        consumers++;
      } else assert.equal(resource, undefined);
    }
  }
  assert.ok(consumers > 0);
});

test("mixed component design styles retain their actual rendered resource scope in one pass", async () => {
  const fixture = await sharedFixture();
  await fixture.reset();
  for (const [stylesheet] of sharedDesignStylesheets)
    await fixture.edit(
      sharedStylesheetPath(stylesheet),
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
      stylesheetScope(result, sharedStylesheetPath(stylesheet)),
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
      .map(([stylesheet]) => ({
        kind: "dependency",
        path: sharedStylesheetPath(stylesheet),
        analysis: { status: "unresolved", selectors: ["body"] },
      }));
    const reasons = reasonsOf(result, path);
    assert.ok(reasons.every((reason) => reason.kind === "dependency"));
    assert.deepEqual(resourceReasonSummaries(reasons), expectedReasons, path);
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
  assert.equal("sharedImpact" in result, false);
  assert.ok(
    result.screens.some((screen) =>
      screen.views.some((view) =>
        view.reasons?.some(
          (reason) => reason.path === sharedStylesheetPath("design.css"),
        ),
      ),
    ),
    "rendered design CSS retains resource evidence",
  );
  assert.deepEqual(result.affectedConsumers, []);
});
