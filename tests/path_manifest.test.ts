import assert from "node:assert/strict";
import test from "node:test";

import {
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("manifest v8 retains both folder sources and validates carrier fields", async (t) => {
  const fixture = await pathFixture({
    "helpers/folders.ts": `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'account',title:'Accounts'});`,
    "specs/folders.mockup.ts": "export {default} from '../helpers/folders';",
    "specs/account/page.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  const manifest = (await fixture.compile()).manifest;
  assert.equal(manifest.folders[0]?.sourcePath, "specs/folders.mockup.ts");
  assert.ok(manifest.sourceFiles.includes("helpers/folders.ts"));
  assert.ok(manifest.sourceFiles.includes("specs/folders.mockup.ts"));
  assert.deepEqual(parseHistoricalManifest(manifest), parseManifest(manifest));
  const omitted = {
    ...manifest,
    sourceFiles: manifest.sourceFiles.filter(
      (file) => file !== "specs/folders.mockup.ts",
    ),
  };
  assert.throws(
    () => parseManifest(omitted),
    /sourceFiles omits specs\/folders.mockup.ts/,
  );
  const invalid = {
    ...manifest,
    folders: manifest.folders.map((folder) => ({
      ...folder,
      exclude: ["drafts/**"],
    })),
  };
  assert.throws(() => parseManifest(invalid), /unknown field exclude/);
});

test("reserved document metadata permits an empty description but no stored routes", () => {
  const manifest = {
    schemaVersion: 8,
    generatedBy: "mokly",
    folders: [],
    sourceFiles: ["specs/guide.md"],
    entries: [
      {
        kind: "document",
        path: "guide",
        title: "Guide",
        description: "",
        sourcePath: "specs/guide.md",
        declaredDependencies: [],
        relatedDocs: [],
        resources: [],
        colorSchemes: ["light"],
      },
    ],
  };
  assert.deepEqual(parseManifest(manifest), manifest);
  assert.throws(
    () =>
      parseManifest({
        ...manifest,
        entries: [{ ...manifest.entries[0], route: "guide/index.html" }],
      }),
    /unsupported route/,
  );
  assert.throws(
    () =>
      parseManifest({
        ...manifest,
        entries: [
          {
            ...manifest.entries[0],
            kind: "page",
            resources: undefined,
            colorSchemes: undefined,
          },
        ],
      }),
    /missing description/,
  );
});

test("manifest paths reject different spellings of the same folder", () => {
  const entry = {
    kind: "page",
    path: "Account/first",
    title: "Page",
    description: "Page",
    sourcePath: "specs/page.mockup.ts",
    declaredDependencies: [],
    relatedDocs: [],
  };
  const manifest = {
    schemaVersion: 8,
    generatedBy: "mokly",
    folders: [],
    sourceFiles: [entry.sourcePath],
    entries: [entry, { ...entry, path: "account/second" }],
  };
  assert.throws(() => parseManifest(manifest), /differ only by letter case/);
});

test("persisted variants cannot become folder indexes", () => {
  const entry = {
    kind: "screen",
    path: "screen",
    title: "Screen",
    description: "Screen",
    sourcePath: "specs/screen.mockup.ts",
    declaredDependencies: [],
    relatedDocs: [],
    colorSchemes: ["light"],
    useCasePaths: [],
  };
  const manifest = {
    schemaVersion: 8,
    generatedBy: "mokly",
    folders: [],
    sourceFiles: [entry.sourcePath],
    entries: [
      entry,
      { ...entry, path: "screen/state", variantOf: "screen" },
      { ...entry, path: "screen/state/child" },
    ],
  };
  assert.throws(
    () => parseManifest(manifest),
    /variant cannot be a folder's own page/,
  );
});
