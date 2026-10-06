import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { designEntries } from "./helpers/design_catalogue.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("mixed component design styles retain their actual rendered resource scope", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [stylesheet, screens, components] of [
    ["design-components.css", 39, 69],
    ["design-component-inspection.css", 39, 69],
    ["design-component-details.css", 39, 69],
    ["design-component-inspector.css", "all-design", 69],
    ["design-component-workspace.css", "all-design", 69],
    ["design-component-view.css", 39, 69],
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
      const expected = await designEntries(
        (entry) =>
          generatedViews(entry).some((view) =>
            textOutput(fixture.before.outputs, view.path)!.includes(
              `/${stylesheet}"`,
            ),
          ),
        `rendered resources for ${stylesheet}`,
        fixture.before.manifest.entries,
      );
      const expectedScreens = expected.filter(
        (entry) => entry.kind === "screen",
      );
      if (screens === "all-design") {
        const allDesignScreens = await designEntries(
          (entry) =>
            entry.kind === "screen" && entry.path.startsWith("design/"),
          "baseline design screens",
          fixture.before.manifest.entries,
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
          result.sharedImpact.includes("examples/basic/generated/design.css"),
          "the glob remains diagnostic evidence without adding unrelated entries",
        );
    });
});
