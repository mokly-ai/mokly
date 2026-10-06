import assert from "node:assert/strict";
import test from "node:test";

import {
  generatedViews,
  isManifestComponentVariant,
} from "../packages/viewer/dist/data.js";

import { named } from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  designEntries,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

const { manifest, outputs } = await designCatalogue;

function component(id: string) {
  const entry = manifest.entries.find((entry) => entry.path === id);
  if (entry?.kind !== "component" || isManifestComponentVariant(entry))
    throw new Error(`Missing ${id}`);
  return entry;
}

test("the shared footer exposes only the icon panel and its current variants", async () => {
  const footer = component("design/library/inspector/inspector");
  assert.deepEqual(
    (
      await designEntries(
        (entry) =>
          entry.kind === "component" &&
          isManifestComponentVariant(entry) &&
          entry.variantOf === footer.path,
        "shared footer variants",
      )
    ).map((variant) => variant.path),
    [
      "design/library/inspector/inspector/details",
      "design/library/inspector/inspector/props",
      "design/library/inspector/inspector/closed",
    ],
  );
  if (footer.propSchema.kind !== "object")
    throw new Error("Invalid footer schema");
  for (const key of ["presentation", "legacyBehavior", "legacyDestination"])
    assert.equal(Object.hasOwn(footer.propSchema.properties, key), false, key);
});

test("view options have one icon presentation and no view-controls scheme control", () => {
  const controls = component("design/library/controls/view-controls");
  const topBar = component("design/library/chrome/top-bar");
  if (
    controls.propSchema.kind !== "object" ||
    topBar.propSchema.kind !== "object"
  )
    throw new Error("Invalid control schema");
  for (const key of [
    "presentation",
    "scheme",
    "schemeDisabled",
    "schemeControl",
    "destinations",
  ])
    assert.equal(
      Object.hasOwn(controls.propSchema.properties, key),
      false,
      key,
    );
  assert.equal(
    Object.hasOwn(topBar.propSchema.properties, "appearance"),
    true,
    "the top bar owns the catalogue's one appearance setting",
  );
  assert.equal(
    Object.hasOwn(topBar.propSchema.properties, "schemeDestinations"),
    false,
  );
});

test("every owning design and shared sample omits legacy footer and view markup", async () => {
  const entries = await designEntries(
    (entry) =>
      entry.path.startsWith("design/") &&
      (entry.kind === "screen" ||
        (entry.kind === "component" && isManifestComponentVariant(entry))),
    "owning designs and shared variants",
  );
  assert.equal(entries.length, 180);
  for (const entry of entries) {
    if (
      entry.kind === "screen" ||
      (entry.kind === "component" && isManifestComponentVariant(entry))
    )
      for (const file of generatedViews(entry).map((view) => view.path)) {
        const html = textOutput(outputs, file);
        assert.ok(html, file);
        assert.doesNotMatch(html, /class="mbk-details(?:-bar|-hint)?"/, file);
        assert.doesNotMatch(
          html,
          /role="group" aria-label="(?:Viewport|Preview color scheme)"/,
          file,
        );
      }
  }
});

const withoutInspector = new Set([
  "design/browse/views/home",
  "design/browse/states/missing-route",
  "design/browse/states/navigation",
  "design/browse/views/use-case",
  "design/browse/appearance/status/home",
  "design/browse/appearance/status/flow",
  "design/browse/appearance/workspaces/drawer",
]);

test("every selected screen uses one inspector and one preview toolbar", async () => {
  const screens = await designEntries(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
    "modern screen controls",
  );
  for (const entry of screens) {
    for (const viewport of ["desktop", "mobile"] as const) {
      const { document } = await designDocument(entry.path, viewport);
      assert.equal(byClass(document, "mbk-details-bar").length, 0, entry.path);
      assert.equal(
        elements(
          document,
          (node) =>
            attribute(node, "role") === "group" &&
            /^(Viewport|Preview color scheme)$/u.test(
              attribute(node, "aria-label") ?? "",
            ),
        ).length,
        0,
        entry.path,
      );
      if (withoutInspector.has(entry.path)) {
        assert.equal(byClass(document, "ce-inspector").length, 0, entry.path);
        assert.equal(
          byClass(document, "ce-view-controls").length,
          0,
          entry.path,
        );
        continue;
      }
      assert.equal(byClass(document, "ce-inspector").length, 1, entry.path);
      const documentPage =
        entry.path.startsWith("design/browse/pages/") ||
        [
          "design/browse/views/folder-overview",
          "design/browse/appearance/states/light-only-current",
          "design/browse/appearance/states/light-only-document",
        ].includes(entry.path);
      if (documentPage) {
        assert.equal(
          byClass(document, "ce-view-controls").length,
          0,
          entry.path,
        );
      } else
        assert.equal(
          attribute(named(document, "Preview options"), "role"),
          "toolbar",
          entry.path,
        );
      assert.equal(
        byClass(byClass(document, "mbk-topbar")[0]!, "ce-view-controls").length,
        0,
        entry.path,
      );
    }
  }
});
