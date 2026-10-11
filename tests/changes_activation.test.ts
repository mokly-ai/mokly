import assert from "node:assert/strict";
import test from "node:test";

import { viewHref } from "../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV10,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { changesActivation } from "../packages/viewer/dist/shell/changes_activation.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import type { ShellRoute } from "../packages/viewer/dist/shell/routes.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { defaultSelection } from "../packages/viewer/dist/viewer/selection.js";

import { currentManifest } from "./helpers/current_manifest.js";

const parent = screen("welcome", "Welcome", "welcome/index.html");
const empty = {
  ...screen("welcome/empty", "Empty workspace", "welcome/empty/index.html"),
  variantOf: parent.path,
};
const failure = {
  ...screen("welcome-failure", "Failure", "welcome-failure/index.html"),
  tags: ["errors"],
  variantOf: parent.path,
};
const manifest: ManifestV10 = currentManifest({
  entries: [parent, empty, failure],
  generatedBy: "mokly",
  schemaVersion: 10,
  folders: [],
  sourceFiles: [parent.sourcePath],
});
const catalogue = createCatalogue(manifest);
const context: ShellContext = {
  activeId: parent.path,
  base: "main",
  changedEntries: [empty.path, failure.path],
  changesStatus: "ready",
  componentChanges: {
    baseline: manifest,
    screenViews: [
      {
        path: empty.path,
        views: [
          {
            colorScheme: "light",
            state: "changed",
            viewport: "mobile",
          },
        ],
      },
      {
        path: failure.path,
        views: [
          {
            colorScheme: "dark",
            state: "changed",
            viewport: "desktop",
          },
        ],
      },
    ],
  },
  updateVersion: 1,
};

test("an aggregate parent opens its first visible changed variant and view", () => {
  const activated = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    route(parent),
  );

  assert.equal(target(activated).path, failure.path);
  assert.equal(activated.viewport, "desktop");
  assert.equal(activated.colorScheme, "dark");
});

test("a changed row opens its own first changed view", () => {
  const activated = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, screenPath: parent.path, view: "changes" },
    route(empty),
  );

  assert.equal(target(activated).path, empty.path);
  assert.equal(activated.viewport, "mobile");
  assert.equal(activated.colorScheme, "light");
});

test("navigation within Changes keeps the sticky view axes", () => {
  const activated = changesActivation(
    catalogue,
    context,
    {
      ...defaultSelection,
      colorScheme: "light",
      screenPath: empty.path,
      view: "changes",
      viewport: "both",
    },
    route(failure),
  );

  assert.equal(target(activated).path, failure.path);
  assert.equal(activated.viewport, undefined);
  assert.equal(activated.colorScheme, undefined);
});

test("navigation within Changes still redirects an aggregate parent", () => {
  const activated = changesActivation(
    catalogue,
    context,
    {
      ...defaultSelection,
      colorScheme: "light",
      screenPath: empty.path,
      search: "failure",
      view: "changes",
      viewport: "both",
    },
    route(parent),
  );

  assert.equal(target(activated).path, failure.path);
  assert.equal(activated.viewport, undefined);
  assert.equal(activated.colorScheme, undefined);
});

test("an explicit axis prevents automatic view selection", () => {
  const activated = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    { ...route(parent), viewport: "mobile" },
  );

  assert.equal(target(activated).path, failure.path);
  assert.equal(activated.viewport, "mobile");
  assert.equal(activated.colorScheme, undefined);
});

test("only a valid explicit axis suppresses first-changed-view landing", () => {
  const partial = routeFromUrl(
    catalogue,
    new URL(
      `https://example.test${viewHref(parent.path)}?viewport=invalid&scheme=light`,
    ),
  );
  const partialActivation = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    partial,
  );
  assert.equal(target(partialActivation).path, failure.path);
  assert.equal(partialActivation.viewport, undefined);
  assert.equal(partialActivation.colorScheme, "light");

  const invalid = routeFromUrl(
    catalogue,
    new URL(
      `https://example.test${viewHref(parent.path)}?viewport=mobile&viewport=desktop&scheme=invalid`,
    ),
  );
  const automatic = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    invalid,
  );
  assert.equal(target(automatic).path, failure.path);
  assert.equal(automatic.viewport, "desktop");
  assert.equal(automatic.colorScheme, "dark");
});

test("All activation keeps the requested row and sticky axes", () => {
  const requested = route(parent);
  assert.equal(
    changesActivation(catalogue, context, defaultSelection, requested),
    requested,
  );
});

function route(entry: ManifestScreen): ShellRoute {
  return {
    view: { kind: "target", target: { kind: "entry", entry } },
  };
}

function target(route: ShellRoute): ManifestScreen {
  assert.equal(route.view.kind, "target");
  assert.equal(route.view.target.entry.kind, "screen");
  return route.view.target.entry as ManifestScreen;
}

function screen(id: string, title: string, _route: string): ManifestScreen {
  return {
    colorSchemes: ["light"],
    description: title,
    path: id,
    kind: "screen",

    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    tags: [],
    title,
    useCasePaths: [],
  };
}
