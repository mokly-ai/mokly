import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { createElement } from "react";

import type { RenderContext } from "@mokly/mokly";

import { settingsDialogInput } from "../components/settings-dialog";
import { settingsLayerInput } from "../components/settings-layer";
import { panes, sections } from "../screens/product/settings/panes";

import { catalogueRoot, screenFile } from "./catalogue-paths";
import { loadCatalogue } from "./load-catalogue";
import { situationStatePaths } from "./product-situations";
import {
  settingsRegistryViolations,
  settingsSituations,
  settingsSurfaces,
} from "./settings-policy";

test("the pane registry matches the settings dialog contract", () => {
  assert.deepEqual(
    panes.map((pane) => [pane.section, pane.id]),
    [
      ["You", "account"],
      ["Workspace", "workspace"],
      ["Workspace", "github"],
      ["Workspace", "members"],
      ["Workspace", "billing"],
      ["Project", "project"],
      ["Project", "tokens"],
      ["Project", "access"],
      ["Project", "danger"],
    ],
  );
  assert.deepEqual([...sections], ["You", "Workspace", "Project"]);
  const contract = readFileSync(
    resolve(catalogueRoot, "../protocol/settings-dialog.md"),
    "utf8",
  );
  for (const pane of panes)
    assert.ok(contract.includes("`" + pane.id + "`"), pane.id);
});

test("each pane is registered once and shares one component across viewports", async () => {
  const entries = await loadCatalogue();
  assert.deepEqual(settingsRegistryViolations(entries), []);
  assert.equal(settingsSurfaces.length, 10);
  const screen = entries.find(
    (entry) => entry.path === "product/settings/tokens",
  );
  assert.ok(screen?.kind === "screen");
  assert.ok(
    settingsRegistryViolations(
      entries.map((entry) =>
        entry.path === "product/settings/tokens" &&
        entry.kind === "screen" &&
        "render" in entry
          ? {
              ...entry,
              render: (
                props: Readonly<Record<string, unknown>>,
                context: RenderContext,
              ) =>
                context.viewport === "desktop"
                  ? createElement("div")
                  : entry.render(props, context),
            }
          : entry,
      ),
    ).includes("dialog and layer share one component: product/settings/tokens"),
  );
  assert.ok(
    settingsRegistryViolations(
      entries.filter((entry) => entry.path !== "product/settings/access"),
    ).length,
  );
  assert.ok(settingsRegistryViolations([...entries, screen]).length);
});

test("the dialog frame and the mobile layer are registered layouts", async () => {
  const entries = await loadCatalogue();
  for (const [id, input] of [
    ["design/settings-dialog", settingsDialogInput],
    ["design/settings-layer", settingsLayerInput],
  ] as const) {
    const entry = entries.find((item) => item.path === id);
    assert.equal(entry?.kind, "component", id);
    if (entry?.kind !== "component" || !("render" in entry)) continue;
    const saved = entries.filter(
      (item) => "variantOf" in item && item.variantOf === id,
    );
    assert.ok(saved.length > 0 && saved.length <= 5);
    assert.equal(entry.render, input.render, id + " registers its own input");
  }
  const surface = readFileSync(
    resolve(catalogueRoot, "src/screens/product/settings/surface.tsx"),
    "utf8",
  );
  assert.ok(surface.includes("entries/design/settings-dialog.mockup"));
  assert.ok(surface.includes("entries/design/settings-layer.mockup"));
});

test("every generated pane document draws its frame and at most one overlay over an inert page", () => {
  const documents = [
    ...settingsSurfaces.flatMap((surface) =>
      ["", "/empty", "/loading", "/error"].map((state) => ({
        surface,
        id: "product/settings/" + surface + state,
        overlay: false,
      })),
    ),
    ...settingsSituations.flatMap((situation) =>
      situationStatePaths(situation).map((id) => ({
        surface: situation.screen,
        id,
        overlay: "overlay" in situation && situation.overlay,
      })),
    ),
  ];
  for (const { surface, id, overlay = false } of documents) {
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(id, viewport, scheme), "utf8");
        const dialogs = html.match(/role="dialog"/g) ?? [];
        assert.equal(
          dialogs.length,
          (viewport === "desktop" ? 1 : 0) + (overlay ? 1 : 0),
          surface + " overlays",
        );
        assert.equal(
          (html.match(/<main/g) ?? []).length,
          1,
          surface + " main landmark",
        );
        assert.equal(
          (html.match(/<h1/g) ?? []).length,
          1,
          surface + " primary heading",
        );
        assert.equal(
          html.includes("fo-settings-backdrop"),
          viewport === "desktop",
        );
      }
  }
});
