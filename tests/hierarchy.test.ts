import assert from "node:assert/strict";
import test from "node:test";

import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
} from "../dist/authoring/types.js";
import { defineCollection, defineScreen } from "../dist/index.js";
import {
  createManifest,
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";
import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";

interface TestEntry {
  childIds?: readonly string[];
  id: string;
  kind: "collection" | "screen" | "use-case";
  title: string;
}

test("hierarchy derives roots, children, parents, and ordered ancestors", () => {
  const account = entry("account", "collection", "Account", ["security"]);
  const security = entry("security", "collection", "Security", ["password"]);
  const password = entry("password", "screen", "Password");
  const tour = entry("tour", "use-case", "Tour");
  const home = entry("home", "screen", "Home");

  const { hierarchy, issues } = analyzeHierarchy([
    password,
    home,
    security,
    tour,
    account,
  ]);

  assert.deepEqual(issues, []);
  assert.deepEqual(
    hierarchy.roots.map(({ id }) => id),
    ["account", "home", "tour"],
  );
  assert.equal(hierarchy.parentById.get("password")?.id, "security");
  assert.deepEqual(
    hierarchy.childrenById.get("account")?.map(({ id }) => id),
    ["security"],
  );
  assert.deepEqual(
    hierarchy.ancestorsById.get("password")?.map(({ title }) => title),
    ["Account", "Security"],
  );
  assert.deepEqual(hierarchy.ancestorsById.get("home"), []);
  assert.deepEqual(hierarchy.ancestorsById.get("tour"), []);
});

test("hierarchy reports forest violations deterministically", () => {
  const entries = [
    entry("z-parent", "collection", "Z", ["shared"]),
    entry("shared", "screen", "Shared"),
    entry("cycle-b", "collection", "B", ["cycle-a"]),
    entry("a-parent", "collection", "A", ["shared", "shared", "missing"]),
    entry("cycle-a", "collection", "A", ["cycle-b"]),
    entry("self", "collection", "Self", ["self"]),
  ];

  const first = analyzeHierarchy(entries);
  const second = analyzeHierarchy([...entries].reverse());
  const summaries = first.issues.map(({ code, entry: owner, message }) => ({
    code,
    message,
    ownerId: owner.id,
  }));

  assert.deepEqual(
    summaries,
    second.issues.map(({ code, entry: owner, message }) => ({
      code,
      message,
      ownerId: owner.id,
    })),
  );
  assert.deepEqual(summaries, [
    {
      code: "duplicate-child",
      message: 'child id "shared" is listed more than once',
      ownerId: "a-parent",
    },
    {
      code: "missing-child",
      message: "unknown child id: missing",
      ownerId: "a-parent",
    },
    {
      code: "multiple-parents",
      message: "child shared is already claimed by collection a-parent",
      ownerId: "z-parent",
    },
    {
      code: "collection-cycle",
      message: "collection cycle: cycle-a -> cycle-b -> cycle-a",
      ownerId: "cycle-b",
    },
    {
      code: "collection-cycle",
      message: "collection cycle: self -> self",
      ownerId: "self",
    },
  ]);
});

test("manifest paths are derived from collection ancestry", () => {
  const manifest = hierarchyManifest();
  const paths = Object.fromEntries(
    manifest.entries.map(({ id, navPath }) => [id, navPath]),
  );

  assert.deepEqual(paths, {
    loose: [],
    nested: ["Root"],
    root: [],
    screen: ["Root", "Nested"],
  });
});

test("manifest validation guards cycles while retaining historical paths", () => {
  const manifest = hierarchyManifest();
  const historical = structuredClone(manifest) as unknown as MutableManifest;
  const screen = historical.entries.find(({ id }) => id === "screen");
  assert.ok(screen);
  screen.navPath = ["Historical", "Labels"];

  const parsed = parseManifest(historical);
  assert.deepEqual(parsed.entries.find(({ id }) => id === "screen")?.navPath, [
    "Historical",
    "Labels",
  ]);

  const malformed = structuredClone(manifest) as unknown as MutableManifest;
  const nested = malformed.entries.find(({ id }) => id === "nested");
  assert.ok(nested);
  nested.childIds = ["root"];
  assert.throws(
    () => parseManifest(malformed),
    /collection cycle: nested -> root -> nested/,
  );

  const versionTwo = structuredClone(manifest) as unknown as MutableManifest;
  versionTwo.schemaVersion = 2;
  Object.assign(versionTwo, { legacyPages: [] });
  delete versionTwo.generatedBy;
  assert.equal(parseHistoricalManifest(versionTwo, true).schemaVersion, 3);
});

function entry(
  id: string,
  kind: TestEntry["kind"],
  title: string,
  childIds?: readonly string[],
): TestEntry {
  return { ...(childIds ? { childIds } : {}), id, kind, title };
}

type MutableManifest = Omit<
  ManifestV5,
  "entries" | "generatedBy" | "schemaVersion"
> & {
  entries: Array<{
    childIds?: string[];
    id: string;
    navPath: string[];
  }>;
  generatedBy?: "mokly";
  schemaVersion: number;
};

function hierarchyManifest(): ManifestV5 {
  return createManifest(
    [
      resolved(
        defineCollection({
          childIds: ["nested"],
          dependencies: [],
          description: "Root collection",
          id: "root",
          relatedDocs: [],
          title: "Root",
        }),
      ),
      resolved(
        defineCollection({
          childIds: ["screen"],
          dependencies: [],
          description: "Nested collection",
          id: "nested",
          relatedDocs: [],
          title: "Nested",
        }),
      ),
      resolved(screenDefinition("screen")),
      resolved(screenDefinition("loose")),
    ],
    [],
    ["light"],
  );
}

function screenDefinition(id: string): RegistryDefinition {
  return defineScreen({
    dependencies: [],
    description: `${id} screen`,
    desktop: id,
    id,
    mobile: id,
    relatedDocs: [],
    route: `${id}.html`,
    title: id === "screen" ? "Screen" : "Loose",
  });
}

function resolved(definition: RegistryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    sourcePath: `/repo/entries/${definition.id}.mockup.tsx`,
    sourceRelativePath: `entries/${definition.id}.mockup.tsx`,
  };
}
