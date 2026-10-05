import assert from "node:assert/strict";
import test from "node:test";

import { defineScreen } from "../dist/authoring/definitions.js";
import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { defineComponent } from "../dist/components/definition.js";
import { createManifest, parseManifest } from "../dist/registry/manifest.js";
import { entryRoute } from "../packages/viewer/dist/data.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";

import { resolvedEntry } from "./helpers/resolved.js";

test("manifest emits variantOf only for screen variants", () => {
  const manifest = variantManifest();
  const parent = manifest.entries.find(({ path }) => path === "welcome");
  const variant = manifest.entries.find(({ path }) => path === "welcome/empty");

  assert.equal(Object.hasOwn(parent ?? {}, "variantOf"), false);
  assert.equal(
    variant?.kind === "screen" ? variant.variantOf : undefined,
    "welcome",
  );
  assert.equal(parseManifest(manifest).schemaVersion, 8);
});

test("manifest and hierarchy keep authored sibling variant order", () => {
  const parent = resolvedScreen("welcome");
  const zeta = resolvedScreen("welcome-zeta", parent.path);
  const alpha = resolvedScreen("welcome-alpha", parent.path);
  const manifest = createManifest([parent, zeta, alpha], [], ["light"]);

  assert.deepEqual(
    manifest.entries.map(({ path }) => path),
    [parent.path, zeta.path, alpha.path],
  );
  assert.deepEqual(
    manifest.entries.map(({ path }) => entryRoute(path)),
    [
      "welcome/index.html",
      "welcome-zeta/index.html",
      "welcome-alpha/index.html",
    ],
  );
  assert.deepEqual(
    analyzeHierarchy(manifest.entries)
      .hierarchy.variantsByPath.get(parent.path)
      ?.map(({ path }) => path),
    [zeta.path, alpha.path],
  );
});

test("manifest validation rejects stored routes", () => {
  const rerouted = mutableManifest(variantManifest());
  manifestEntry(rerouted, "welcome/empty").route = "elsewhere/index.html";
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
    Object.assign(manifestEntry(unknown, variant.path), {
      variantOf: "missing",
      path: "missing/state",
    });
    assert.throws(
      () => parseManifest(unknown),
      /variant parent does not exist/,
    );

    const wrongKind = structuredClone(original);
    wrongKind.entries.push({
      description: "Page",
      kind: "page",
      path: "page-parent",

      relatedDocs: [],
      sourcePath: parent.sourcePath,
      title: "Page",
    });
    Object.assign(manifestEntry(wrongKind, variant.path), {
      variantOf: "page-parent",
      path: "page-parent/state",
    });
    assert.throws(
      () => parseManifest(wrongKind),
      new RegExp(`parent is not a ${kind}`),
    );

    const nested = structuredClone(original);
    nested.entries.push({
      ...structuredClone(variant),
      path: `${variant.path}/nested`,
      variantOf: variant.path,
    });
    assert.throws(() => parseManifest(nested), /parent is itself a variant/);

    const relocated = structuredClone(original);
    manifestEntry(relocated, variant.path).path = "declared/variant";
    assert.throws(
      () => parseManifest(relocated),
      /variant path must be parent path plus one segment/,
    );
  });

for (const kind of ["screen", "component"] as const)
  test(`${kind} v8 entries reject stored variants arrays`, () => {
    const original = mutableManifest(manifestForKind(kind));
    for (const entry of original.entries.filter((item) => item.kind === kind)) {
      const stored = structuredClone(original);
      manifestEntry(stored, entry.path).variants = [];
      assert.throws(() => parseManifest(stored), /variants/);
    }
  });

test("component v8 parents require at least one variant", () => {
  const manifest = mutableManifest(componentVariantManifest());
  manifest.entries = manifest.entries.filter(
    (entry) => typeof entry.variantOf !== "string",
  );
  assert.throws(() => parseManifest(manifest), /component has no variants/);
});

test("current non-screen manifest entries reject variant fields", () => {
  const manifest = mutableManifest(variantManifest());
  const page: MutableEntry = {
    description: "Page",
    kind: "page",
    path: "page",

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
    [resolvedScreen("welcome"), resolvedScreen("welcome/empty", "welcome")],
    [],
    ["light"],
  );
}

function componentVariantManifest() {
  const definitions = defineComponent({
    description: "Action",
    path: "action",

    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => null,
    title: "Action",
    variants: [
      {
        slug: "default",

        props: {},
        title: "Default",
      },
    ],
  }).entries.map((entry) => resolvedEntry(entry, "entries/action.mockup.tsx"));
  return createManifest(
    definitions,
    [],
    ["light"],
    new Map(
      (["mobile", "desktop"] as const).map((viewport) => [
        `action/default/index.${viewport}.html`,
        {
          viewport,
          colorScheme: "light" as const,
          instances: [],
          slots: [],
          ranges: [],
          styles: [],
          resources: [],
        },
      ]),
    ),
  );
}

function manifestForKind(kind: "component" | "screen") {
  return kind === "screen" ? variantManifest() : componentVariantManifest();
}

function resolvedScreen(id: string, variantOf?: string): ResolvedRegistryEntry {
  return {
    ...resolvedEntry(
      defineScreen({
        slug: id,
        path: id,
        title: id,
        description: `${id} screen`,
        relatedDocs: [],
        desktop: id,
        mobile: id,
      }),
      `entries/${id}.mockup.tsx`,
    ),
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

interface MutableEntry extends Record<string, unknown> {
  path: string;
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
  const entry = manifest.entries.find((candidate) => candidate.path === id);
  assert.ok(entry);
  return entry;
}
