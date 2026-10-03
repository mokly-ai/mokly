import assert from "node:assert/strict";
import test from "node:test";

import { viewHref } from "../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV8,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { changesActivation } from "../packages/viewer/dist/shell/changes_activation.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import type { ShellRoute } from "../packages/viewer/dist/shell/routes.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { defaultSelection } from "../packages/viewer/dist/viewer/selection.js";

const parent = screen("welcome", "Welcome", "screens/welcome.html");
const empty = {
  ...screen("welcome-empty", "Empty workspace", "screens/welcome-empty.html"),
  variantOf: parent.id,
};
const failure = {
  ...screen("welcome-failure", "Failure", "screens/welcome-failure.html"),
  tags: ["errors"],
  variantOf: parent.id,
};
const manifest: ManifestV8 = {
  entries: [parent, empty, failure],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [parent.sourcePath],
};
const catalogue = createCatalogue(manifest);
const context: ShellContext = {
  activeId: parent.id,
  base: "main",
  changedIds: [empty.id, failure.id],
  changesStatus: "ready",
  componentChanges: {
    baseline: manifest,
    screenViews: [
      {
        id: empty.id,
        views: [
          {
            colorScheme: "light",
            state: "changed",
            viewport: "mobile",
          },
        ],
      },
      {
        id: failure.id,
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

  assert.equal(target(activated).id, failure.id);
  assert.equal(activated.viewport, "desktop");
  assert.equal(activated.colorScheme, "dark");
});

test("a changed row opens its own first changed view", () => {
  const activated = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, screenId: parent.id, view: "changes" },
    route(empty),
  );

  assert.equal(target(activated).id, empty.id);
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
      screenId: empty.id,
      view: "changes",
      viewport: "both",
    },
    route(failure),
  );

  assert.equal(target(activated).id, failure.id);
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
      screenId: empty.id,
      search: "failure",
      view: "changes",
      viewport: "both",
    },
    route(parent),
  );

  assert.equal(target(activated).id, failure.id);
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

  assert.equal(target(activated).id, failure.id);
  assert.equal(activated.viewport, "mobile");
  assert.equal(activated.colorScheme, undefined);
});

test("only a valid explicit axis suppresses first-changed-view landing", () => {
  const partial = routeFromUrl(
    catalogue,
    new URL(
      `https://example.test${viewHref("screen", parent.id)}?viewport=invalid&scheme=light`,
    ),
  );
  const partialActivation = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    partial,
  );
  assert.equal(target(partialActivation).id, failure.id);
  assert.equal(partialActivation.viewport, undefined);
  assert.equal(partialActivation.colorScheme, "light");

  const invalid = routeFromUrl(
    catalogue,
    new URL(
      `https://example.test${viewHref("screen", parent.id)}?viewport=mobile&viewport=desktop&scheme=invalid`,
    ),
  );
  const automatic = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", search: "failure" },
    invalid,
  );
  assert.equal(target(automatic).id, failure.id);
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
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    tags: [],
    title,
    useCaseIds: [],
  };
}
