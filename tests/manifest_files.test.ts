import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { defineScreen, defineUseCase } from "../dist/authoring/definitions.js";
import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { pendingGeneratedOrphanRoutes } from "../dist/build/ownership.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import {
  createManifest,
  MANIFEST_NAME,
  parseManifest,
  readManifest,
  serializeManifest,
} from "../dist/registry/manifest.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { resolvedEntry } from "./helpers/resolved.js";
test("current filesystem reads reject an earlier-name manifest sentinel", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "mockbook-manifest.json"),
    '{"schemaVersion":6}\n',
  );

  assert.throws(() => readManifest(config), /could not read/);
});

test("filesystem manifest loading never accepts v2 under the canonical filename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const legacy = toV2Manifest((await compileCatalogue(config)).manifest);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, MANIFEST_NAME),
    JSON.stringify(legacy),
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "mockbook-manifest.json"),
    JSON.stringify(legacy),
  );

  assert.throws(() => readManifest(config), /schema version 8/);
});

test("manifest loading rejects stored routes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = structuredClone((await compileCatalogue(config)).manifest);
  const screen = manifest.entries.find((entry) => entry.kind === "screen");
  if (!screen || screen.kind !== "screen") throw new Error("screen missing");
  Object.assign(screen, { route: "screens/home?alternate.html" });

  assert.throws(() => parseManifest(manifest), /unsupported route/);
});

test("manifest validates retained color schemes and rejects stored view paths", () => {
  const manifest = manifestWithScreen("a");
  const screen = manifest.entries[0];
  if (!screen || screen.kind !== "screen") throw new Error("screen missing");
  screen.colorSchemes = ["light", "dark"];
  assert.doesNotThrow(() => parseManifest(manifest));

  const invalidShape = structuredClone(manifest);
  Object.assign(invalidShape.entries[0]!, { colorSchemes: ["dark"] });
  assert.throws(() => parseManifest(invalidShape), /invalid colorSchemes/);
  const stored = structuredClone(manifest);
  Object.assign(stored.entries[0]!, { fragments: {} });
  assert.throws(() => parseManifest(stored), /unsupported fragments/);
});

test("manifest validation accepts tags and rejects invalid ones", () => {
  const manifest = manifestWithScreen("a");
  const screen = manifest.entries[0];
  if (!screen || screen.kind !== "screen") throw new Error("screen missing");
  screen.tags = ["forms", "onboarding"];
  assert.doesNotThrow(() => parseManifest(manifest));

  for (const invalidTags of [["forms", 7], [""], "forms"]) {
    const invalid = structuredClone(manifest);
    Object.assign(invalid.entries[0]!, { tags: invalidTags });
    assert.throws(() => parseManifest(invalid), /a has invalid tags/);
  }
});

test("light-only manifests remain deterministic without variant metadata", () => {
  const entry = resolvedScreen();
  const expected = serializeManifest({
    entries: [
      {
        colorSchemes: ["light"],
        description: "A screen",
        path: "a",
        kind: "screen",

        relatedDocs: [],
        sourcePath: "entries/a.mockup.tsx",
        title: "A",
        useCasePaths: [],
      },
    ],
    generatedBy: "mokly",
    sourceFiles: ["entries/a.mockup.tsx"],
    schemaVersion: 8 as const,
    folders: [],
  });

  const serialized = serializeManifest(createManifest([entry], [], ["light"]));
  assert.equal(serialized, expected);
  assert.equal(serialized.includes("darkFragments"), false);
  assert.equal(serialized.includes("tags"), false);
});

test("manifest serializes declared tags and omits absent ones", () => {
  const serialized = serializeManifest(
    createManifest(
      [
        resolvedScreen("a", {
          tags: ["onboarding", "forms"],
          useCasePaths: ["tour", "untagged-tour"],
        }),
        resolvedScreen("b", { tags: [] }),
        resolvedScreen("c"),
        resolvedUseCase(["forms"]),
        resolvedUseCase([], "untagged-tour"),
      ],
      [],
      ["light"],
    ),
  );
  const entries = parseManifest(JSON.parse(serialized)).entries;

  assert.deepEqual(
    entries.map((entry) => [entry.path, Object.hasOwn(entry, "tags")]),
    [
      ["a", true],
      ["b", false],
      ["c", false],
      ["tour", true],
      ["untagged-tour", false],
    ],
  );
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry), Object.keys(entry).sort());
  }
});

test("disabling dark orphans committed dark fragments", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const darkConfig = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(darkConfig), darkConfig);

  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  const lightConfig = await loadConfig(fixture.root);
  const lightCompilation = await compileCatalogue(lightConfig);
  const orphans = pendingGeneratedOrphanRoutes(
    lightConfig,
    lightCompilation.outputs.keys(),
  );
  assert.deepEqual(orphans, [
    "details/index.desktop.dark.html",
    "details/index.mobile.dark.html",
    "home/index.desktop.dark.html",
    "home/index.mobile.dark.html",
  ]);
  assert.throws(
    () => checkCompilation(lightCompilation, lightConfig),
    /orphan generated files[\s\S]*\.dark\.html/,
  );

  await writeCompilation(lightCompilation, lightConfig);
  for (const route of orphans) {
    assert.equal(fs.existsSync(path.join(fixture.mockupsDir, route)), false);
  }
});

function toV2Manifest(manifest: unknown): Record<string, unknown> {
  const legacy: Record<string, unknown> = {
    ...(manifest as Record<string, unknown>),
    schemaVersion: 2,
  };
  delete legacy.generatedBy;
  return legacy;
}

function manifestWithScreen(id: string) {
  return createManifest([resolvedScreen(id)], [], ["light"]);
}

function resolvedUseCase(
  tags?: readonly string[],
  id = "tour",
): ResolvedRegistryEntry {
  return resolvedEntry(
    defineUseCase({
      description: "A journey",
      path: id,

      relatedDocs: [],
      steps: [{ screenPath: "a" }],
      ...(tags ? { tags } : {}),
      title: "Tour",
    }),
    `entries/${id}.mockup.tsx`,
  );
}

function resolvedScreen(
  id = "a",
  options: { tags?: readonly string[]; useCasePaths?: readonly string[] } = {},
): ResolvedRegistryEntry {
  return resolvedEntry(
    defineScreen({
      slug: id,
      description: "A screen",
      desktop: null,
      path: id,
      mobile: null,
      relatedDocs: [],
      ...(options.tags ? { tags: options.tags } : {}),
      title: id.toUpperCase(),
      useCasePaths: options.useCasePaths ?? [],
    }),
    `entries/${id}.mockup.tsx`,
  );
}
