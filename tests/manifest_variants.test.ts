import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { createManifest, parseManifest } from "../dist/registry/manifest.js";
import { entryRoute } from "../packages/viewer/dist/data.js";
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
  assert.equal(parseManifest(manifest).schemaVersion, 7);
});

test("manifest and hierarchy keep authored sibling variant order", () => {
  const parent = resolvedScreen("welcome");
  const zeta = resolvedScreen("welcome-zeta", parent.id);
  const alpha = resolvedScreen("welcome-alpha", parent.id);
  const manifest = createManifest([parent, zeta, alpha], [], ["light"]);

  assert.deepEqual(
    manifest.entries.map(({ id }) => id),
    [parent.id, zeta.id, alpha.id],
  );
  assert.deepEqual(
    manifest.entries.map(({ id, kind }) => entryRoute(kind, id)),
    [
      "screens/welcome.html",
      "screens/welcome-zeta.html",
      "screens/welcome-alpha.html",
    ],
  );
  assert.deepEqual(
    analyzeHierarchy(manifest.entries)
      .hierarchy.variantsById.get(parent.id)
      ?.map(({ id }) => id),
    [zeta.id, alpha.id],
  );
});

test("manifest validation rejects broken variant parents and stored routes", () => {
  const unknown = mutableManifest(variantManifest());
  screenEntry(unknown, "welcome-empty").variantOf = "missing";
  assert.throws(() => parseManifest(unknown), /variant parent does not exist/);

  const nonScreen = mutableManifest(variantManifest());
  nonScreen.entries.push({
    declaredDependencies: [],
    description: "Page",
    kind: "page",
    id: "page",
    navPath: [],
    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    title: "Page",
  });
  screenEntry(nonScreen, "welcome-empty").variantOf = "page";
  assert.throws(() => parseManifest(nonScreen), /parent is not a screen/);

  const rerouted = mutableManifest(variantManifest());
  screenEntry(rerouted, "welcome-empty").route = "screens/elsewhere.html";
  assert.throws(() => parseManifest(rerouted), /unsupported route/);
});

test("manifest validation rejects nested variants and mismatched paths", () => {
  const nested = createManifest(
    [
      resolvedScreen("base"),
      resolvedScreen("welcome", "base"),
      resolvedScreen("welcome-empty", "welcome"),
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
    declaredDependencies: [],
    description: "Page",
    kind: "page",
    id: "page",
    navPath: [],
    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    title: "Page",
  };
  page.variantOf = undefined;
  manifest.entries.push(page);
  assert.throws(() => parseManifest(manifest), /unsupported variantOf/);
});

function variantManifest() {
  return createManifest(
    [resolvedScreen("welcome"), resolvedScreen("welcome-empty", "welcome")],
    [],
    ["light"],
  );
}

function resolvedScreen(id: string, variantOf?: string): ResolvedRegistryEntry {
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
