import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import type { ManifestV7 } from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { legacyManifestFromV7 } from "./helpers/historical_manifest.js";

type Entry = Record<string, unknown> & { id: string; kind: string };
interface HistoricalInput {
  schemaVersion: number;
  generatedBy: string;
  entries: Entry[];
  legacyPages?: unknown[];
  sourceFiles?: string[];
}

function collection(id: string, childIds: unknown): Entry {
  return {
    id,
    kind: "collection",
    title: id,
    description: id,
    navPath: [],
    childIds,
    sourcePath: "entries/fixture.mockup.tsx",
    dependencies: ["entries/fixture.mockup.tsx", "notes.md"],
    declaredDependencies: ["notes.md"],
    relatedDocs: [],
  };
}

function envelope(
  version: "v3" | "component v4" | "pages v4" | "v5",
  current: ManifestV7,
): HistoricalInput {
  return legacyManifestFromV7(
    current,
    version === "v3" ? 3 : version === "v5" ? 5 : 4,
    version === "component v4" ? "components" : "pages",
  ) as HistoricalInput;
}

function historicalCollectionFields(input: HistoricalInput): void {
  if (
    input.schemaVersion === 3 ||
    (input.schemaVersion === 4 && input.sourceFiles)
  ) {
    for (const entry of input.entries)
      if (entry.kind === "collection") delete entry.declaredDependencies;
  }
}

const invalidCases: Array<{
  name: string;
  mutate: (input: HistoricalInput) => void;
  message: string;
}> = [
  {
    name: "duplicate child",
    mutate: ({ entries }) => {
      entries.push(collection("group", ["home", "home"]));
    },
    message:
      'group has an invalid relationship: child id "home" is listed more than once',
  },
  {
    name: "unknown child",
    mutate: ({ entries }) => {
      entries.push(collection("group", ["missing"]));
    },
    message: "group has an invalid relationship: unknown child id: missing",
  },
  {
    name: "child claimed twice",
    mutate: ({ entries }) => {
      entries.push(
        collection("first", ["home"]),
        collection("second", ["home"]),
      );
    },
    message:
      "second has an invalid relationship: child home is already claimed by collection first",
  },
  {
    name: "self cycle",
    mutate: ({ entries }) => {
      entries.push(collection("group", ["group"]));
    },
    message:
      "group has an invalid relationship: collection cycle: group -> group",
  },
  {
    name: "longer cycle",
    mutate: ({ entries }) => {
      entries.push(
        collection("first", ["second"]),
        collection("second", ["third"]),
        collection("third", ["first"]),
      );
    },
    message:
      "first has an invalid relationship: collection cycle: first -> second -> third -> first",
  },
  {
    name: "collection claims a screen variant",
    mutate: ({ entries }) => {
      const parent = entries.find((entry) => entry.id === "home");
      assert.ok(parent);
      const route = "screens/home.variants/empty.html";
      entries.push(
        {
          ...parent,
          id: "home-empty",
          variantOf: "home",
          route,
          fragments: {
            mobile: "screens/home.variants/empty.mobile.html",
            desktop: "screens/home.variants/empty.desktop.html",
          },
        },
        collection("group", ["home-empty"]),
      );
    },
    message:
      "group has an invalid relationship: collection group claims variant home-empty",
  },
  {
    name: "non-array childIds",
    mutate: ({ entries }) => {
      entries.push(collection("group", "home"));
    },
    message: "group has invalid childIds",
  },
];

test("historical collection shape and relationships validate before records are dropped", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const manifest = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  const current = manifest;
  for (const version of ["v3", "component v4", "pages v4", "v5"] as const) {
    const valid = envelope(version, current);
    valid.entries.push(collection("group", ["home"]));
    historicalCollectionFields(valid);
    assert.deepEqual(
      parseHistoricalManifest(valid).entries.map(({ id }) => id),
      normalizedIds(valid),
      version,
    );
    for (const { name, mutate, message } of invalidCases) {
      const input = envelope(version, current);
      mutate(input);
      historicalCollectionFields(input);
      assert.throws(
        () => parseHistoricalManifest(input),
        (error: Error) => {
          assert.equal(
            error.message,
            `[mokly/manifest-invalid] ${message}`,
            `${version}: ${name}`,
          );
          return true;
        },
        `${version}: ${name}`,
      );
    }
  }
});

function normalizedIds(input: HistoricalInput): string[] {
  return input.entries
    .filter((entry) => entry.kind !== "collection")
    .flatMap((entry) => [
      entry.id,
      ...(Array.isArray(entry.variants)
        ? entry.variants.flatMap((variant) =>
            variant &&
            typeof variant === "object" &&
            "id" in variant &&
            typeof variant.id === "string"
              ? [variant.id]
              : [],
          )
        : []),
    ]);
}
