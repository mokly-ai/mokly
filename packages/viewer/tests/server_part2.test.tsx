import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import { renderViewer } from "../src/viewer/server.js";

import { fixture } from "./server_fixture.js";

test("SSR selects a component variant entry in navigation, chrome, and preview", () => {
  const model = structuredClone(fixture);
  const component = model.components[0]!;
  const original = catalogueComponentVariants(model, component.path)[0]!;
  model.components = [
    ...model.components,
    {
      ...structuredClone(original),
      path: "components/action/second",
      title: "Second",
      views: original.views.map((view) => structuredClone(view)),
    },
  ];
  const componentFolder = model.tree.find(
    (node) => node.kind === "folder" && node.path === "components",
  );
  const actionNode = componentFolder?.children?.find(
    (node) => node.kind === "entry" && node.path === component.path,
  );
  if (actionNode?.kind === "entry")
    actionNode.children = [
      ...(actionNode.children ?? []),
      { kind: "entry", path: "components/action/second" },
    ];
  const html = renderViewer({
    viewerId: "fixture",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath: "components/action/second" },
  });
  assert.match(html, /<h2>Action<\/h2>/);
  assert.match(
    html,
    /data-copy-path="components\/action\/second"[^>]*>components\/action\/second<\/button>/,
  );
  assert.match(
    html,
    /aria-label="Catalogue location"[^]*href="\/view\/components\/action\/"[^]*Action/,
  );
  assert.match(
    html,
    /aria-label="Saved variants"[^]*aria-current="page"[^]*href="\/view\/components\/action\/second\/"[^]*Second/,
  );
  assert.match(
    html,
    /data-nav-disclosure="variants:components\/action"[^]*data-route="components\/action\/second\/index\.html"/,
  );
  assert.match(
    html,
    /components\/action\/second\/index\.(?:mobile|desktop)\.html/,
  );
});

test("SSR resolves light fallback evidence across status, marks and comparison", () => {
  const model = structuredClone(fixture);
  const screen = model.screens.find(
    (entry) => entry.path === "product/browse/home",
  );
  const component = model.components.find(
    (entry) => entry.path === "components/action",
  );
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
  for (const variant of catalogueComponentVariants(model, component.path)) {
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
      screenPath: screen.path,
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
  const component = model.components.find(
    (entry) => entry.path === "components/action",
  );
  if (!component || "variantOf" in component)
    throw new Error("Missing component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };

  const html = renderViewer({
    viewerId: "unknown-evidence",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath: component.path },
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
      defaultSelection: { screenPath: screen.path },
    }),
  );
});
