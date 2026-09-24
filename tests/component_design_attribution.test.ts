import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("declared library CSS is owned only by rendered design components", async (t) => {
  const fixture = await designLibraryFixture(t);
  const stylesheet = "design-library/chrome/top-bar.css";
  const owner = { path: stylesheet, componentIds: ["design-ui-top-bar"] };
  const component = fixture.before.manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(component?.kind === "component");
  assert.deepEqual(
    component.variants[0]!.componentViews[0]!.resources.find(
      (resource) => resource.path === stylesheet,
    ),
    owner,
  );
  let consumers = 0;
  for (const entry of fixture.before.manifest.entries) {
    if (entry.kind !== "screen") continue;
    for (const view of entry.componentViews ?? []) {
      const rendersTopBar = view.instances.some(
        (instance) => instance.componentId === component.id,
      );
      const resource = view.resources.find(
        (record) => record.path === stylesheet,
      );
      if (rendersTopBar) {
        assert.deepEqual(resource, owner);
        consumers++;
      } else assert.equal(resource, undefined);
    }
  }
  assert.ok(consumers > 0);
});

test("mixed component design styles retain their actual rendered resource scope", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [stylesheet, screens, components] of [
    ["design-components.css", 32, 16],
    ["design-component-inspection.css", 32, 16],
    ["design-component-details.css", 32, 16],
    ["design-component-inspector.css", 88, 16],
    ["design-component-workspace.css", 88, 16],
    ["design-component-view.css", 32, 16],
    ["design-component-controls.css", 11, 16],
    ["design.css", 88, 16],
    ["design-library.css", 0, 16],
  ] as const)
    await t.test(stylesheet, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/generated/${stylesheet}`,
        (source) => source + "\nbody { gap: 17px; }\n",
      );
      const expected = fixture.before.manifest.entries.filter((entry) =>
        generatedViews(entry).some((view) =>
          fixture.before.outputs.get(view.path)!.includes(`/${stylesheet}"`),
        ),
      );
      assert.equal(
        expected.filter((entry) => entry.kind === "screen").length,
        screens,
      );
      assert.equal(
        expected.filter((entry) => entry.kind === "component").length,
        components,
      );
      const result = await fixture.compare();
      const ids = expected.map((entry) => entry.id);
      assert.deepEqual(
        result.changes
          .map((change) => (change.after ?? change.before)!.id)
          .sort(),
        ids.sort(),
      );
      if (stylesheet !== "design.css")
        assert.ok(
          result.changes.every((change) =>
            (change.after ?? change.before)!.route.startsWith("design/"),
          ),
          "unrelated Example content stays unchanged",
        );
      else
        assert.ok(
          result.sharedImpact.includes("examples/basic/generated/design.css"),
          "the glob remains diagnostic evidence without adding unrelated entries",
        );
    });
});
