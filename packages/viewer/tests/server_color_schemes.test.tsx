import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import { renderViewer } from "../src/viewer/server.js";

import { fixture } from "./server_fixture.js";

test("SSR resolves light fallback evidence across status, marks and comparison", () => {
  const model = structuredClone(fixture);
  const screen = model.screens.find((entry) => entry.id === "home");
  const component = model.components.find((entry) => entry.id === "action");
  if (!screen || !component || "variantOf" in component)
    throw new Error("Missing mixed-view fixture");
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.views = screen.views.map((view) => ({
    ...view,
    comparison: {
      status: "ready",
      kind: view.viewport === "mobile" ? "unmodified" : "changed",
      eligible: view.viewport !== "mobile",
    },
  }));
  component.colorSchemes = ["light", "dark"];
  for (const variant of catalogueComponentVariants(model, component.id)) {
    variant.colorSchemes = ["light", "dark"];
    variant.views = variant.views.flatMap((view) => [
      view,
      {
        ...structuredClone(view),
        colorScheme: "dark" as const,
      },
    ]);
  }

  const html = renderViewer({
    viewerId: "mixed",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: {
      screenId: screen.id,
      viewport: "mobile",
      colorScheme: "dark",
    },
  });

  assert.match(html, /data-workspace-status="">Unmodified</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
  assert.match(html, /data-view-changed="scheme" hidden=""/);
  assert.doesNotMatch(html, /data-view-changed="viewport" hidden=""/);
});

test("SSR preserves comparison ineligibility while view evidence is unknown", () => {
  const model = structuredClone(fixture);
  const component = model.components.find((entry) => entry.id === "action");
  if (!component || "variantOf" in component)
    throw new Error("Missing component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };

  const html = renderViewer({
    viewerId: "unknown-evidence",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenId: component.id },
  });

  assert.match(html, /data-workspace-status="">Changed</);
  assert.match(html, /class="mbk-diff-toolbar" hidden=""/);
});

test("incomplete current view axes are rejected", () => {
  const model = structuredClone(fixture);
  const screen = model.screens[0]!;
  screen.views = [];
  assert.throws(() =>
    renderViewer({
      viewerId: "fixture",
      catalogue: model,
      baseUrl: "https://catalogue.example",
      defaultSelection: { screenId: screen.id },
    }),
  );
});
