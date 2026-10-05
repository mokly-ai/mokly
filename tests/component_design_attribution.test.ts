import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentVariants } from "./helpers/component_views.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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

test("mixed component design styles retain their actual rendered resource scope", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [stylesheet, screens, components] of [
    ["design-components.css", 41, 69],
    ["design-component-inspection.css", 41, 69],
    ["design-component-details.css", 41, 69],
    ["design-component-inspector.css", "all-design", 69],
    ["design-component-workspace.css", "all-design", 69],
    ["design-component-view.css", 41, 69],
    ["design-component-controls.css", 11, 69],
    ["design.css", "all-design", 69],
    ["design-library.css", 0, 69],
  ] as const)
    await t.test(stylesheet, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/generated/${stylesheet}`,
        (source) => source + "\nbody { gap: 17px; }\n",
      );
      const expected = fixture.before.manifest.entries.filter((entry) =>
        generatedViews(entry).some((view) =>
          textOutput(fixture.before.outputs, view.path)!.includes(
            `/${stylesheet}"`,
          ),
        ),
      );
      const expectedScreens = expected.filter(
        (entry) => entry.kind === "screen",
      );
      if (screens === "all-design") {
        const allDesignScreens = fixture.before.manifest.entries.filter(
          (entry) =>
            entry.kind === "screen" && entry.path.startsWith("design/"),
        );
        assert.deepEqual(
          expectedScreens.map(({ path }) => path).sort(),
          allDesignScreens.map(({ path }) => path).sort(),
        );
      } else assert.equal(expectedScreens.length, screens);
      assert.equal(
        expected.filter((entry) => entry.kind === "component").length,
        components,
      );
      const result = await fixture.compare();
      const ids = expected.map((entry) => entry.path);
      assert.deepEqual(
        result.changes
          .map((change) => (change.after ?? change.before)!.path)
          .sort(),
        ids.sort(),
      );
      if (stylesheet !== "design.css")
        assert.ok(
          result.changes.every((change) =>
            (change.after ?? change.before)!.path.startsWith("design/"),
          ),
          "unrelated Example content stays unchanged",
        );
      else
        assert.ok(
          result.screens.some((screen) =>
            screen.views.some((view) =>
              view.reasons?.some(
                (reason) =>
                  reason.path === "examples/basic/generated/design.css",
              ),
            ),
          ),
          "rendered design CSS retains resource evidence",
        );
    });
});
