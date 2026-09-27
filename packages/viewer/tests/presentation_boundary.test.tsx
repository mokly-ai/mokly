import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueView } from "../src/catalogue/types.js";
import { renderViewer } from "../src/viewer/server.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v3.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("SSR preserves pending entry and saved-variant comparison eligibility", () => {
  for (const screenId of ["home", "action"] as const) {
    const model = structuredClone(fixture);
    const entry =
      screenId === "home"
        ? model.screens.find(({ id }) => id === screenId)!
        : model.components.find(({ id }) => id === screenId)!;
    entry.changes = { status: "ready", included: true, kind: "changed" };
    const variant =
      entry.kind === "component"
        ? catalogueComponentVariants(model, entry.id)[0]!
        : undefined;
    const views =
      variant?.views ?? (entry.kind === "screen" ? entry.views : []);
    if (variant) variant.comparison = { status: "pending" };
    for (const view of views) view.comparison = { status: "pending" };

    const html = renderViewer({
      viewerId: `pending-${screenId}`,
      catalogue: model,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId },
    });
    assert.match(html, /data-workspace-status="">Changed<\/span>/);
    assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
  }
});

test("SSR uses effective Light evidence for light-only screens and variants", () => {
  const originalScreenModel = structuredClone(fixture);
  const screenModel = {
    ...originalScreenModel,
    components: originalScreenModel.components.map((candidate) =>
      "variantOf" in candidate && candidate.variantOf === "action"
        ? {
            ...candidate,
            colorSchemes: ["light", "dark"] as const,
            views: withDarkViews(candidate.views),
          }
        : candidate,
    ),
  };
  const home = screenModel.screens[0]!;
  for (const view of home.views)
    view.comparison = {
      status: "ready",
      kind: "unmodified",
      eligible: false,
    };
  home.changes = { status: "ready", included: true, kind: "changed" };
  const screenHtml = renderViewer({
    viewerId: "light-only-screen",
    catalogue: screenModel,
    baseUrl: "https://catalogue.example",
    defaultSelection: {
      screenId: home.id,
      colorScheme: "dark",
      viewport: "both",
    },
  });
  assert.match(screenHtml, /data-workspace-status="">Unmodified<\/span>/);
  assert.match(screenHtml, /class="mbk-diff-toolbar" hidden=""/);

  const originalComponentModel = structuredClone(fixture);
  const componentModel = {
    ...originalComponentModel,
    screens: originalComponentModel.screens.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            colorSchemes: ["light", "dark"] as const,
            views: withDarkViews(candidate.views),
          }
        : candidate,
    ),
  };
  const lightComponent = componentModel.components[0]!;
  lightComponent.changes = {
    status: "ready",
    included: true,
    kind: "changed",
  };
  const selected = catalogueComponentVariants(
    componentModel,
    lightComponent.id,
  )[0]!;
  selected.comparison = { status: "ready", kind: "changed", eligible: true };
  for (const view of selected.views)
    view.comparison = { status: "ready", kind: "changed", eligible: true };
  const componentHtml = renderViewer({
    viewerId: "light-only-component",
    catalogue: componentModel,
    baseUrl: "https://catalogue.example",
    defaultSelection: {
      screenId: selected.id,
      colorScheme: "dark",
      viewport: "both",
    },
  });
  assert.match(componentHtml, /data-workspace-status="">Changed<\/span>/);
  assert.match(componentHtml, /data-view-changed="scheme" hidden=""/);
});

function withDarkViews<T extends CatalogueView>(views: readonly T[]): T[] {
  return views.flatMap((view) => [
    view,
    {
      ...view,
      colorScheme: "dark" as const,
    },
  ]);
}
