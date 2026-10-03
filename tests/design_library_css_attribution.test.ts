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
      assertComponentRows(result, fixture, [`design-ui-${slug}`]);
      const consumers = fixture.before.manifest.entries
        .flatMap((entry) =>
          entry.kind === "screen" &&
          generatedViews(entry).some((view) =>
            view.usage?.instances.some(
              (instance) => instance.componentId === `design-ui-${slug}`,
            ),
          )
            ? [entry.id]
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
            affected.consumer.kind === "screen" ? [affected.consumer.id] : [],
          )
          .sort(),
        consumers,
      );
      if (slug === "tag-chip") {
        const topBar = result.affectedConsumers.find(
          (affected) =>
            affected.consumer.kind === "component" &&
            affected.consumer.id === "design-ui-top-bar",
        );
        assert.ok(topBar);
        const variants = topBar.evidence.flatMap((evidence) =>
          evidence.context.kind === "component" &&
          evidence.context.entry.id === "design-ui-top-bar"
            ? [evidence.context.variantId]
            : [],
        );
        assert.deepEqual(
          [...new Set(variants)],
          ["design-ui-top-bar-tag-picker"],
        );
        assert.ok(
          topBar.evidence.some(
            (evidence) =>
              evidence.via.map((item) => item.componentId).join("/") ===
              "design-ui-top-bar/design-ui-tag-picker/design-ui-tag-chip",
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
      ["design-ui-tag-chip"],
      ".mbk-chip.tag",
    ],
    [
      "example-components.css",
      ["example-action", "example-toolbar"],
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
            ? [entry.id]
            : [],
        )
        .sort();
      assert.ok(consumers.length > 0);
      assert.deepEqual(
        [
          ...new Set(
            result.affectedConsumers.flatMap((affected) =>
              affected.consumer.kind === "screen" ? [affected.consumer.id] : [],
            ),
          ),
        ].sort(),
        consumers,
      );
    });
});
