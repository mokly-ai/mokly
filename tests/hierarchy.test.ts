import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy, navPathKey } from "@mokly/viewer/data";

import { defineScreen } from "../dist/index.js";
import {
  createManifest,
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";

const entry = (
  id: string,
  kind: string,
  title: string,
  navPath: unknown,
  variantOf?: string,
) => ({ id, kind, title, navPath, ...(variantOf ? { variantOf } : {}) });

test("section folders merge identical labels, order folders first, and retain authored variants", () => {
  const entries = [
    entry("a", "screen", "Alpha", ["Design", "Browse"]),
    entry("z", "screen", "Zed", ["Design"]),
    entry("component", "component", "Button", ["Design"]),
    entry("b", "page", "Beta", ["Design", "Browse"]),
    entry("variant-b", "screen", "Second", ["Design", "Browse"], "a"),
    entry("variant-a", "screen", "First", ["Design", "Browse"], "a"),
  ];
  const { hierarchy, issues } = analyzeHierarchy(entries);
  assert.deepEqual(issues, []);
  assert.equal(navPathKey(["Design", "Browse"]), "Design/Browse");
  assert.deepEqual(hierarchy.ancestorsById.get("a"), ["Design", "Browse"]);
  assert.deepEqual(hierarchy.ancestorsById.get("component"), ["Design"]);
  assert.deepEqual(
    hierarchy.variantsById.get("a")?.map(({ id }) => id),
    ["variant-b", "variant-a"],
  );
  assert.equal(hierarchy.variantParentById.get("variant-a"), entries[0]);
  assert.deepEqual(
    hierarchy.roots.pages.map(({ label }) => label),
    ["Design"],
  );
  assert.deepEqual(
    hierarchy.roots.components.map(({ label }) => label),
    ["Design"],
  );
  const design = hierarchy.roots.pages[0];
  assert.equal(design?.kind, "folder");
  if (design?.kind !== "folder") return;
  assert.deepEqual(
    design.children.map(({ label }) => label),
    ["Browse", "Zed"],
  );
  const browse = design.children[0];
  assert.equal(browse?.kind, "folder");
  if (browse?.kind === "folder")
    assert.deepEqual(
      browse.children.map(({ label }) => label),
      ["Alpha", "Beta"],
    );
});

test("case, whitespace, and leaf/folder conflicts are scoped to one section", () => {
  const caseConflict = analyzeHierarchy([
    entry("a", "screen", "A", ["Design"]),
    entry("b", "screen", "B", ["design"]),
  ]);
  assert.equal(caseConflict.issues[0]?.code, "nav-path-conflict");
  const whitespace = analyzeHierarchy([
    entry("a", "screen", "A", ["Two Words"]),
    entry("b", "screen", "B", ["TwoWords"]),
  ]);
  assert.equal(whitespace.issues[0]?.code, "nav-path-conflict");
  const leaf = analyzeHierarchy([
    entry("a", "screen", "Settings", []),
    entry("b", "screen", "B", ["settings"]),
  ]);
  assert.match(
    leaf.issues[0]?.message ?? "",
    /append the folder label.*navPath/,
  );
  assert.deepEqual(
    analyzeHierarchy([
      entry("a", "screen", "A", ["Design"]),
      entry("b", "component", "B", ["design"]),
    ]).issues,
    [],
  );
});

test("folder-versus-leaf conflicts always name and attach to the leaf regardless of order", () => {
  const leaf = entry("leaf", "screen", "Settings", []);
  const folderMember = entry("member", "page", "Nested", ["settings"]);
  const issues = [
    analyzeHierarchy([leaf, folderMember]).issues,
    analyzeHierarchy([folderMember, leaf]).issues,
  ].map((found) =>
    found.map(({ code, entry: owner, message }) => ({
      code,
      id: owner.id,
      message,
    })),
  );
  assert.deepEqual(issues[0], issues[1]);
  const conflicts = issues[0]!;
  assert.deepEqual(
    conflicts.map(({ id }) => id),
    ["leaf"],
  );
  assert.match(conflicts[0]!.message, /leaf.*Settings.*settings.*navPath/);
});

test("folder spelling conflicts report once per spelling and source in either input order", () => {
  const established = ["first", "second", "third", "fourth"].map((id) => ({
    ...entry(id, "screen", id, ["A", "Packed ESM"]),
    sourceRelativePath: "entries/established.mockup.tsx",
  }));
  const culprit = {
    ...entry("culprit", "screen", "Culprit", ["A", "packed  esm"]),
    sourceRelativePath: "entries/culprit.mockup.tsx",
  };
  const reports = [
    analyzeHierarchy([...established, culprit]).issues,
    analyzeHierarchy([culprit, ...established.toReversed()]).issues,
  ].map((issues) =>
    issues.map(({ code, entry: owner, message }) => ({
      code,
      id: owner.id,
      source: owner.sourceRelativePath,
      message,
    })),
  );
  assert.deepEqual(reports[0], reports[1]);
  assert.deepEqual(
    reports[0]?.map(({ id, source }) => [id, source]),
    [
      ["first", "entries/established.mockup.tsx"],
      ["culprit", "entries/culprit.mockup.tsx"],
    ],
  );
  for (const issue of reports[0] ?? []) {
    assert.equal(issue.code, "nav-path-conflict");
    assert.match(issue.message, /Packed ESM.*packed {2}esm.*under Pages › A/);
  }
});

test("top-level folder conflicts name the Pages section rather than an empty path", () => {
  const issues = analyzeHierarchy([
    entry("first", "screen", "First", ["Design"]),
    entry("second", "screen", "Second", ["design"]),
  ]).issues;
  assert.equal(issues.length, 2);
  for (const issue of issues)
    assert.match(issue.message, /Design.*design.*at the top of Pages/);
});

test("each spelling and source is named when several spellings collide", () => {
  const entries = [
    {
      ...entry("first", "screen", "First", ["Packed ESM"]),
      sourceRelativePath: "entries/first.mockup.tsx",
    },
    {
      ...entry("second", "screen", "Second", ["packed  esm"]),
      sourceRelativePath: "entries/second.mockup.tsx",
    },
    {
      ...entry("third", "screen", "Third", ["PACKED ESM"]),
      sourceRelativePath: "entries/third.mockup.tsx",
    },
  ];
  const issues = analyzeHierarchy(entries).issues;
  assert.deepEqual(
    issues.map(({ entry: owner }) => owner.id),
    ["third", "first", "second"],
  );
  for (const issue of issues)
    assert.match(
      issue.message,
      /"PACKED ESM".*"Packed ESM".*"packed {2}esm".*at the top of Pages/,
    );
});

test("current labels report every invalid segment, and duplicates remain separate leaves", () => {
  const result = analyzeHierarchy([
    entry("invalid", "screen", "Invalid", ["", " A", "A/ B", 23]),
    entry("first", "screen", "Shared", []),
    entry("second", "screen", "Shared", []),
  ]);
  assert.deepEqual(
    result.issues.map(({ code }) => code),
    Array(4).fill("invalid-nav-path"),
  );
  for (let index = 0; index < 4; index++)
    assert.match(result.issues[index]!.message, new RegExp(`index ${index}`));
  assert.deepEqual(
    result.hierarchy.roots.pages.map(({ kind }) => kind),
    ["entry", "entry"],
  );
});

test("manifest v6 preserves authored paths; v5 baselines validate then discard collection records", () => {
  const screen = defineScreen({
    id: "home",
    title: "Home",
    description: "Home",
    route: "screens/home.html",
    mobile: "Mobile",
    desktop: "Desktop",
    dependencies: [],
    relatedDocs: [],
    navPath: ["Design"],
  });
  const manifest = createManifest(
    [
      {
        ...screen,
        sourceRelativePath: "entries/home.mockup.tsx",
        sourcePath: "/repo/entries/home.mockup.tsx",
      },
    ],
    [],
    ["light"],
  );
  assert.equal(parseManifest(manifest).schemaVersion, 6);
  const old = structuredClone(manifest) as unknown as Record<
    string,
    unknown
  > & { entries: Array<Record<string, unknown>> };
  old.schemaVersion = 5;
  old.entries.unshift({
    id: "design",
    kind: "collection",
    title: "Design",
    description: "Design",
    navPath: [],
    childIds: ["home"],
    dependencies: [],
    declaredDependencies: [],
    relatedDocs: [],
    sourcePath: "entries/home.mockup.tsx",
  });
  assert.throws(() => parseManifest(old), /schema version 6/);
  assert.deepEqual(
    parseHistoricalManifest(old).entries.map(({ id }) => id),
    ["home"],
  );
  old.entries[0]!.childIds = ["missing"];
  assert.throws(() => parseHistoricalManifest(old), /unknown child id/);
});
