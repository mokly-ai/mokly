import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { createManifest, parseManifest } from "../dist/registry/manifest.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";

import { currentManifest } from "./helpers/current_manifest.js";

test("manifest emits variantOf only for screen variants", () => {
  const manifest = variantManifest();
  const parent = manifest.entries.find(({ id }) => id === "welcome");
  const variant = manifest.entries.find(({ id }) => id === "welcome-empty");

  assert.equal(Object.hasOwn(parent ?? {}, "variantOf"), false);
  assert.equal(
    variant?.kind === "screen" ? variant.variantOf : undefined,
    "welcome",
  );
  assert.equal(parseManifest(currentManifest(manifest)).schemaVersion, 6);
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

test("manifest validation rejects broken variant parents and routes", () => {
  const unknown = mutableManifest(variantManifest());
  screenEntry(unknown, "welcome-empty").variantOf = "missing";
  assert.throws(
    () => parseManifest(currentManifest(unknown)),
    /parent screen does not exist/,
  );

  const nonScreen = mutableManifest(variantManifest(true));
  screenEntry(nonScreen, "welcome-empty").variantOf = "screens";
  assert.throws(
    () => parseManifest(currentManifest(nonScreen)),
    /parent is not a screen/,
  );

  const rerouted = mutableManifest(variantManifest());
  const reroutedVariant = screenEntry(rerouted, "welcome-empty");
  reroutedVariant.route = "screens/elsewhere.html";
  reroutedVariant.fragments = {
    desktop: "screens/elsewhere.desktop.html",
    mobile: "screens/elsewhere.mobile.html",
  };
  assert.throws(
    () => parseManifest(currentManifest(rerouted)),
    /route does not match its parent/,
  );
});

test("manifest validation rejects nested and collection-claimed variants", () => {
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
  assert.throws(
    () => parseManifest(currentManifest(nested)),
    /parent is itself a variant/,
  );

  const claimed = variantManifest(true, true);
  assert.throws(
    () => parseManifest(currentManifest(claimed)),
    /collection screens claims variant/,
  );
});

test("current non-screen manifest entries reject variant fields", () => {
  const manifest = mutableManifest(variantManifest(true));
  const collection = manifest.entries.find(({ id }) => id === "screens");
  assert.ok(collection);
  collection.variantOf = undefined;
  assert.throws(
    () => parseManifest(currentManifest(manifest)),
    /unsupported variantOf/,
  );
});

function variantManifest(collection = false, claimVariant = false) {
  return createManifest(
    [
      ...(collection
        ? [
            resolvedCollection(
              claimVariant ? ["welcome", "welcome-empty"] : ["welcome"],
            ),
          ]
        : []),
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
    relatedDocs: [],
    route,
    sourcePath: `entries/${id}.mockup.tsx`,
    sourceRelativePath: `entries/${id}.mockup.tsx`,
    title: id,
    useCaseIds: [],
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

function resolvedCollection(
  childIds: readonly string[],
): ResolvedRegistryEntry {
  return {
    __viaDefine: true,
    childIds,
    dependencies: [],
    description: "Screens",
    id: "screens",
    kind: "collection",
    relatedDocs: [],
    sourcePath: "entries/screens.mockup.tsx",
    sourceRelativePath: "entries/screens.mockup.tsx",
    title: "Screens",
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
