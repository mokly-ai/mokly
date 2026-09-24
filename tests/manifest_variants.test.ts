import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import {
  createManifest,
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";

test("manifest emits variantOf only for screen variants", () => {
  const manifest = variantManifest();
  const parent = manifest.entries.find(({ id }) => id === "welcome");
  const variant = manifest.entries.find(({ id }) => id === "welcome-empty");

  assert.equal(Object.hasOwn(parent ?? {}, "variantOf"), false);
  assert.equal(
    variant?.kind === "screen" ? variant.variantOf : undefined,
    "welcome",
  );
  assert.equal(parseManifest(manifest).schemaVersion, 6);
});

test("manifest and hierarchy keep authored sibling variant order", () => {
  const parent = resolvedScreen("welcome", "screens/welcome.html");
  const zeta = resolvedScreen(
    "welcome-zeta",
    "screens/welcome.variants/zeta.html",
    parent.id,
  );
  const alpha = resolvedScreen(
    "welcome-alpha",
    "screens/welcome.variants/alpha.html",
    parent.id,
  );
  const manifest = createManifest([parent, zeta, alpha], [], ["light"]);

  assert.deepEqual(
    manifest.entries.map(({ id }) => id),
    [parent.id, zeta.id, alpha.id],
  );
  assert.deepEqual(
    analyzeHierarchy(manifest.entries)
      .hierarchy.variantsById.get(parent.id)
      ?.map(({ id }) => id),
    [zeta.id, alpha.id],
  );
});

test("historical v5 permits empty collections but drops them after validation", () => {
  const historical = mutableManifest(variantManifest());
  historical.schemaVersion = 5;
  historical.entries.push({
    id: "screens",
    kind: "collection",
    title: "Screens",
    description: "Screens",
    childIds: [],
    navPath: [],
    dependencies: [],
    declaredDependencies: [],
    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
  });
  assert.deepEqual(
    parseHistoricalManifest(historical).entries.map(({ id }) => id),
    ["welcome", "welcome-empty"],
  );
  assert.throws(() => parseManifest(historical), /schema version 6/);
});

test("manifest validation rejects broken variant parents and routes", () => {
  const unknown = mutableManifest(variantManifest());
  screenEntry(unknown, "welcome-empty").variantOf = "missing";
  assert.throws(() => parseManifest(unknown), /parent screen does not exist/);

  const nonScreen = mutableManifest(variantManifest());
  nonScreen.entries.push({
    ...screenEntry(nonScreen, "welcome"),
    kind: "page",
    id: "page",
    route: "page.html",
  });
  delete nonScreen.entries.at(-1)?.fragments;
  delete nonScreen.entries.at(-1)?.useCaseIds;
  delete nonScreen.entries.at(-1)?.viewports;
  screenEntry(nonScreen, "welcome-empty").variantOf = "page";
  assert.throws(() => parseManifest(nonScreen), /parent is not a screen/);

  const rerouted = mutableManifest(variantManifest());
  const reroutedVariant = screenEntry(rerouted, "welcome-empty");
  reroutedVariant.route = "screens/elsewhere.html";
  reroutedVariant.fragments = {
    desktop: "screens/elsewhere.desktop.html",
    mobile: "screens/elsewhere.mobile.html",
  };
  assert.throws(
    () => parseManifest(rerouted),
    /route does not match its parent/,
  );
});

test("manifest validation rejects nested variants and mismatched paths", () => {
  const nested = createManifest(
    [
      resolvedScreen("base", "screens/base.html"),
      resolvedScreen("welcome", "screens/base.variants/welcome.html", "base"),
      resolvedScreen(
        "welcome-empty",
        "screens/base.variants/welcome.variants/empty.html",
        "welcome",
      ),
    ],
    [],
    ["light"],
  );
  assert.throws(() => parseManifest(nested), /parent is itself a variant/);

  const moved = mutableManifest(variantManifest());
  screenEntry(moved, "welcome-empty").navPath = ["Elsewhere"];
  assert.throws(
    () => parseManifest(moved),
    /variant navPath does not match parent/,
  );
});

test("current non-screen manifest entries reject variant fields", () => {
  const manifest = mutableManifest(variantManifest());
  const page: MutableEntry = {
    ...manifest.entries[0]!,
    kind: "page",
    id: "page",
    route: "page.html",
  };
  for (const field of ["fragments", "useCaseIds", "viewports"])
    delete page[field];
  page.variantOf = undefined;
  manifest.entries.push(page);
  assert.throws(() => parseManifest(manifest), /unsupported variantOf/);
});

function variantManifest() {
  return createManifest(
    [
      resolvedScreen("welcome", "screens/welcome.html"),
      resolvedScreen(
        "welcome-empty",
        "screens/welcome.variants/empty.html",
        "welcome",
      ),
    ],
    [],
    ["light"],
  );
}

function resolvedScreen(
  id: string,
  route: string,
  variantOf?: string,
): ResolvedRegistryEntry {
  return {
    __viaDefine: true,
    dependencies: [],
    description: `${id} screen`,
    desktop: id,
    id,
    kind: "screen",
    mobile: id,
    navPath: [],
    relatedDocs: [],
    route,
    sourcePath: `entries/${id}.mockup.tsx`,
    sourceRelativePath: `entries/${id}.mockup.tsx`,
    title: id,
    useCaseIds: [],
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

interface MutableEntry extends Record<string, unknown> {
  id: string;
  route?: string;
  variantOf?: string | undefined;
}

interface MutableManifest extends Record<string, unknown> {
  entries: MutableEntry[];
}

function mutableManifest(value: unknown): MutableManifest {
  return structuredClone(value) as MutableManifest;
}

function screenEntry(manifest: MutableManifest, id: string): MutableEntry {
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  assert.ok(entry);
  return entry;
}
