import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestScreen,
  ManifestV6,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { changesActivation } from "../packages/viewer/dist/shell/changes_activation.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import type { ShellRoute } from "../packages/viewer/dist/shell/routes.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { defaultSelection } from "../packages/viewer/dist/viewer/selection.js";

type CurrentManifestScreen = ManifestScreen & {
  declaredDependencies: readonly string[];
};

const parent = screen("welcome", "Welcome", "screens/welcome.html");
const empty = {
  ...screen(
    "welcome-empty",
    "Empty workspace",
    "screens/welcome.variants/empty.html",
  ),
  variantOf: parent.id,
};
const failure = {
  ...screen(
    "welcome-failure",
    "Failure",
    "screens/welcome.variants/failure.html",
  ),
  tags: ["errors"],
  variantOf: parent.id,
};
const manifest: ManifestV6 = {
  entries: [parent, empty, failure],
  generatedBy: "mokly",
  schemaVersion: 6,
  sourceFiles: [parent.sourcePath],
};
const catalogue = createCatalogue(manifest);
const context: ShellContext = {
  activeRoute: parent.route,
  base: "main",
  changedRoutes: [empty.route, failure.route],
  changesStatus: "ready",
  componentChanges: {
    baseline: manifest,
    screenViews: [
      {
        route: empty.route,
        views: [
          {
            colorScheme: "light",
            state: "changed",
            viewport: "mobile",
          },
        ],
      },
      {
        route: failure.route,
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

test("a removed variant redirect retains its exact snapshot despite an id collision", () => {
  const currentCollision = screen(
    empty.id,
    "Current empty screen",
    "screens/current-empty.html",
  );
  const collisionManifest = {
    ...manifest,
    entries: [parent, currentCollision, failure],
  };
  const snapshotId = "a".repeat(64);
  const collisionCatalogue = createCatalogue(collisionManifest, [
    { entry: empty, snapshotId },
  ]);
  const collisionContext = {
    ...context,
    changedRoutes: [empty.route, failure.route],
  };
  const redirected = changesActivation(
    collisionCatalogue,
    collisionContext,
    { ...defaultSelection, search: "empty workspace", view: "changes" },
    route(parent),
  );
  assert.equal(target(redirected).route, empty.route);
  assert.equal(redirected.snapshot, snapshotId);

  const sticky = changesActivation(
    collisionCatalogue,
    collisionContext,
    {
      ...defaultSelection,
      screenId: empty.id,
      snapshotId,
      view: "changes",
    },
    route(failure),
  );
  assert.equal(sticky.viewport, undefined);
  assert.equal(sticky.colorScheme, undefined);

  const legacyCatalogue = createCatalogue(collisionManifest, [
    { entry: empty },
  ]);
  const rejected = changesActivation(
    legacyCatalogue,
    collisionContext,
    { ...defaultSelection, search: "empty workspace", view: "changes" },
    route(parent),
  );
  assert.equal(target(rejected).route, parent.route);
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
      `https://example.test/view/${parent.route}?viewport=invalid&scheme=light`,
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
      `https://example.test/view/${parent.route}?viewport=mobile&viewport=desktop&scheme=invalid`,
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

function screen(
  id: string,
  title: string,
  route: string,
): CurrentManifestScreen {
  const stem = route.replace(/\.html$/, "");
  return {
    declaredDependencies: [],
    dependencies: [],
    description: title,
    fragments: {
      desktop: `${stem}.desktop.html`,
      mobile: `${stem}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    route,
    sourcePath: "entries/welcome.mockup.tsx",
    tags: [],
    title,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
  };
}
