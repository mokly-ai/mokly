import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { designLibrary } from "./helpers/design_library.js";
import {
  selectors,
  assertComponentRows,
} from "./helpers/design_library_css.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("each exclusive library stylesheet changes its component and only affects real consumers", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [group, slug] of designLibrary)
    await t.test(slug, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/generated/design-library/${group}/${slug}.css`,
        (source) => source + `\n${selectors[slug]} { outline-width: 3px; }\n`,
      );
      const result = await fixture.compare();
      assertComponentRows(result, fixture, [`design/library/${group}/${slug}`]);
      const consumers = fixture.before.manifest.entries
        .flatMap((entry) =>
          entry.kind === "screen" &&
          generatedViews(entry).some((view) =>
            view.usage?.instances.some(
              (instance) =>
                instance.componentId === `design/library/${group}/${slug}`,
            ),
          )
            ? [entry.path]
            : [],
        )
        .sort();
      assert.ok(
        consumers.length > 0,
        "every shared component has real screen consumers",
      );
      assert.deepEqual(
        result.affectedConsumers
          .flatMap((affected) =>
            affected.consumer.kind === "screen" ? [affected.consumer.path] : [],
          )
          .sort(),
        consumers,
      );
      if (slug === "tag-chip") {
        const topBar = result.affectedConsumers.find(
          (affected) =>
            affected.consumer.kind === "component" &&
            affected.consumer.path === "design/library/chrome/top-bar",
        );
        assert.ok(topBar);
        const variants = topBar.evidence.flatMap((evidence) =>
          evidence.context.kind === "component" &&
          evidence.context.entry.path === "design/library/chrome/top-bar"
            ? [evidence.context.variantPath]
            : [],
        );
        assert.deepEqual(
          [...new Set(variants)],
          ["design/library/chrome/top-bar/tag-picker"],
        );
        assert.ok(
          topBar.evidence.some(
            (evidence) =>
              evidence.via.map((item) => item.componentId).join("/") ===
              "design/library/chrome/top-bar/design/library/controls/tag-picker/design/library/controls/tag-chip",
          ),
        );
      }
    });
});

test("example CSS changes components with own-page matches and reports consumers", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [file, owners, selector] of [
    [
      "design-library/controls/tag-chip.css",
      ["design/library/controls/tag-chip"],
      ".mbk-chip.tag",
    ],
    [
      "example-components.css",
      ["example/components/action", "example/components/toolbar"],
      ".example-action, .example-toolbar",
    ],
  ] as const)
    await t.test(file, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/generated/${file}`,
        (source) => source + `\n${selector} { outline-width: 3px; }\n`,
      );
      const result = await fixture.compare();
      assertComponentRows(result, fixture, owners);
      const consumers = fixture.before.manifest.entries
        .flatMap((entry) =>
          entry.kind === "screen" &&
          generatedViews(entry).some((view) =>
            view.usage?.instances.some((instance) =>
              (owners as readonly string[]).includes(instance.componentId),
            ),
          )
            ? [entry.path]
            : [],
        )
        .sort();
      assert.ok(consumers.length > 0);
      assert.deepEqual(
        [
          ...new Set(
            result.affectedConsumers.flatMap((affected) =>
              affected.consumer.kind === "screen"
                ? [affected.consumer.path]
                : [],
            ),
          ),
        ].sort(),
        consumers,
      );
    });
});
