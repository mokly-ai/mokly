import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestDocument, ManifestScreen } from "@mokly/viewer/data";

import {
  readMoveResources,
  MoveResources,
} from "../dist/review/moves/resources.js";

const screen: ManifestScreen = {
  kind: "screen",
  path: "invoice",
  sourcePath: "specs/old.tsx",
  title: "Invoice",
  description: "Invoice",
  declaredDependencies: [],
  relatedDocs: [],
  useCasePaths: [],
  colorSchemes: ["light"],
};

test("paired views retain generated resources when references differ without a source move", async () => {
  const reader = (root: string) => {
    const read = async (route: string) =>
      Buffer.from(
        route.endsWith(".html")
          ? `<link rel='stylesheet' href='../mokly-generated/styles/${root}.css'>`
          : ".note { color: blue; }",
      );
    return {
      read,
      readIfExists: async (route: string) =>
        route.endsWith(`/${root}.css`) ? read(route) : undefined,
    };
  };
  const resources = (
    await readMoveResources([screen], [screen], reader("old"), reader("new"))
  ).paired([screen], [screen], []);
  assert.equal(
    resources.identity(
      "before",
      "mokly-generated/styles/old.css",
      "invoice/index.mobile.html",
    ),
    "mokly-generated/styles/new.css",
  );
  assert.deepEqual(
    [...resources.unchangedPaths("mockups")],
    ["mockups/mokly-generated/styles/new.css"],
  );
});

test("unchanged generated references require no move-resource reads", async () => {
  let resourceReads = 0;
  const reader = {
    read: async (route: string) => {
      if (!route.endsWith(".html")) resourceReads++;
      return Buffer.from(
        "<link rel='stylesheet' href='../mokly-generated/styles/same.css'>",
      );
    },
  };
  const resources = await readMoveResources([screen], [screen], reader, reader);
  assert.equal(resourceReads, 0);
  assert.equal(resources.before.size, 0);
  assert.equal(resources.after.size, 0);
});

test("different HTML with the same generated references requires no move-resource reads", async () => {
  let resourceReads = 0;
  const reader = (text: string) => ({
    read: async (route: string) => {
      if (!route.endsWith(".html")) resourceReads++;
      return Buffer.from(
        `<link rel='stylesheet' href='../mokly-generated/styles/same.css'><p>${text}</p>`,
      );
    },
  });
  const resources = await readMoveResources(
    [screen],
    [screen],
    reader("before"),
    reader("after"),
  );
  assert.equal(resourceReads, 0);
  assert.equal(resources.before.size, 0);
});

test("stylesheet aliases require paired-view references even when source paths move", () => {
  const before = "mokly-generated/styles/specs/old.tsx.css";
  const after = "mokly-generated/styles/specs/new.tsx.css";
  const bytes = Buffer.from(".note { color: blue; }");
  const resources = new MoveResources(
    new Map([[before, bytes]]),
    new Map([[after, bytes]]),
  ).paired([screen], [{ ...screen, sourcePath: "specs/new.tsx" }], []);
  assert.equal(resources.identity("before", before), before);
  assert.deepEqual([...resources.unchangedPaths("mockups")], []);
});

test("paired documents with the same source do not read visual move resources", async () => {
  const document: ManifestDocument = {
    kind: "document",
    path: "guide",
    title: "Guide",
    description: "",
    sourcePath: "specs/guide.md",
    colorSchemes: ["light"],
    declaredDependencies: [],
    relatedDocs: [],
    resources: [],
  };
  const reader = {
    read: async () => {
      throw new Error("documents have no visual comparison views");
    },
  };
  const resources = await readMoveResources(
    [document],
    [document],
    reader,
    reader,
  );
  assert.equal(resources.before.size, 0);
  assert.equal(resources.after.size, 0);
});

test("move-resource selection leaves invalid ordinary URLs to resource validation", async () => {
  const reader = (href: string) => ({
    read: async () => Buffer.from(`<link rel='stylesheet' href='${href}'>`),
  });
  const resources = await readMoveResources(
    [screen],
    [screen],
    reader("../ordinary.css"),
    reader("../../ordinary.css"),
  );
  assert.equal(resources.before.size, 0);
  assert.equal(resources.after.size, 0);
});

test("a paired view with changed references reads only that view's move resources", async () => {
  const reader = (side: "before" | "after") => ({
    read: async (route: string) =>
      Buffer.from(
        route.endsWith(".desktop.html")
          ? "<link rel='stylesheet' href='../../ordinary.css'>"
          : route.endsWith(".mobile.html")
            ? `<link rel='stylesheet' href='../mokly-generated/styles/${side}.css'>`
            : ".note { color: blue; }",
      ),
  });
  const resources = await readMoveResources(
    [screen],
    [screen],
    reader("before"),
    reader("after"),
  );
  assert.deepEqual(
    [...resources.before.keys()],
    ["mokly-generated/styles/before.css"],
  );
  assert.deepEqual(
    [...resources.after.keys()],
    ["mokly-generated/styles/after.css"],
  );
});
