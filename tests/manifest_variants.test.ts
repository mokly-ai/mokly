import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { defineComponent } from "../dist/components/definition.js";
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

test("manifest validation rejects stored routes", () => {
  const rerouted = mutableManifest(variantManifest());
  manifestEntry(rerouted, "welcome-empty").route = "screens/elsewhere.html";
  assert.throws(() => parseManifest(rerouted), /unsupported route/);
});

for (const kind of ["screen", "component"] as const)
  test(`${kind} manifest relationships reject missing, wrong-kind, nested, and moved variants`, () => {
    const original = mutableManifest(manifestForKind(kind));
    const parent = original.entries.find(
      (entry) => entry.kind === kind && typeof entry.variantOf !== "string",
    );
    const variant = original.entries.find(
      (entry) => entry.kind === kind && typeof entry.variantOf === "string",
    );
    assert.ok(parent && variant);

    const unknown = structuredClone(original);
    manifestEntry(unknown, variant.id).variantOf = "missing";
    assert.throws(
      () => parseManifest(unknown),
      /variant parent does not exist/,
    );

    const wrongKind = structuredClone(original);
    wrongKind.entries.push({
      declaredDependencies: [],
      description: "Page",
      kind: "page",
      id: "page-parent",
      navPath: [],
      relatedDocs: [],
      sourcePath: parent.sourcePath,
      title: "Page",
    });
    manifestEntry(wrongKind, variant.id).variantOf = "page-parent";
    assert.throws(
      () => parseManifest(wrongKind),
      new RegExp(`parent is not a ${kind}`),
    );

    const nested = structuredClone(original);
    nested.entries.push({
      ...structuredClone(variant),
      id: `${parent.id}-nested`,
      variantOf: variant.id,
    });
    assert.throws(() => parseManifest(nested), /parent is itself a variant/);

    const moved = structuredClone(original);
    manifestEntry(moved, variant.id).navPath = ["Elsewhere"];
    assert.throws(
      () => parseManifest(moved),
      /variant navPath does not match parent/,
    );
  });

for (const kind of ["screen", "component"] as const)
  test(`${kind} v7 entries reject stored variants arrays`, () => {
    const original = mutableManifest(manifestForKind(kind));
    for (const entry of original.entries.filter((item) => item.kind === kind)) {
      const stored = structuredClone(original);
      manifestEntry(stored, entry.id).variants = [];
      assert.throws(() => parseManifest(stored), /variants/);
    }
  });

test("component v7 parents require at least one variant", () => {
  const manifest = mutableManifest(componentVariantManifest());
  manifest.entries = manifest.entries.filter(
    (entry) => typeof entry.variantOf !== "string",
  );
  assert.throws(() => parseManifest(manifest), /component has no variants/);
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

function componentVariantManifest() {
  const definitions = defineComponent({
    dependencies: [],
    description: "Action",
    id: "action",
    navPath: ["Shared"],
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => null,
    title: "Action",
    variants: [{ id: "action-default", props: {}, title: "Default" }],
  }).entries.map((entry): ResolvedRegistryEntry => ({
    ...entry,
    sourcePath: "entries/action.mockup.tsx",
    sourceRelativePath: "entries/action.mockup.tsx",
  }));
  return createManifest(definitions, [], ["light"]);
}

function manifestForKind(kind: "component" | "screen") {
  return kind === "screen" ? variantManifest() : componentVariantManifest();
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

function manifestEntry(manifest: MutableManifest, id: string): MutableEntry {
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  assert.ok(entry);
  return entry;
}
