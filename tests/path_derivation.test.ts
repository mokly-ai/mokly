import assert from "node:assert/strict";
import test from "node:test";

import { pathCollisions } from "../src/registry/path_collisions.js";
import {
  deriveEntryPath,
  movedFromDiagnostic,
} from "../src/registry/path_derivation.js";

const location = "specs/account/invoice.mockup.tsx export default";

test("document leaves stop at the first dot; only exact index names collapse", () => {
  for (const [file, slug] of [
    ["release.notes.md", "release"],
    ["README.extra.md", "README"],
    ["index.draft.md", "index"],
  ] as const)
    assert.deepEqual(
      deriveEntryPath({ file: `account/${file}`, document: true, location }),
      { path: `account/${slug}`, slug, index: false },
    );
});

test("derivation uses roots, transparent directories and file names only", () => {
  assert.deepEqual(
    deriveEntryPath({
      file: "account/__mockups__/Invoice.stories.tsx",
      location,
      prefix: "Specs",
      transparent: ["__mockups__"],
    }),
    { path: "Specs/account/Invoice", slug: "Invoice", index: false },
  );
  assert.deepEqual(
    deriveEntryPath({ file: "invoice/invoice.mockup.tsx", location }),
    { path: "invoice/invoice", slug: "invoice", index: false },
  );
  assert.deepEqual(
    deriveEntryPath({
      file: "account/__mockups__/nested/__mockups__/list.tsx",
      slug: "all",
      location,
      transparent: ["__mockups__"],
    }),
    { path: "account/nested/all", slug: "all", index: false },
  );
});

test("index collapse never invents a catalogue root identity", () => {
  for (const input of [
    { file: "account/index.mockup.tsx" },
    { file: "account/list.tsx", slug: "index" },
  ])
    assert.deepEqual(deriveEntryPath({ ...input, location }), {
      path: "account",
      slug: "index",
      index: true,
    });
  assert.deepEqual(
    deriveEntryPath({
      file: "index.mockup.tsx",
      prefix: "components",
      location,
    }),
    { path: "components", slug: "index", index: true },
  );
  assert.deepEqual(deriveEntryPath({ file: "index.mockup.tsx", location }), {
    code: "root-index",
    message: `${location} has no folder to be the index of; give it a path`,
  });
  assert.deepEqual(
    deriveEntryPath({ file: "index.mockup.tsx", path: "Home", location }),
    { path: "Home", slug: "index", index: true },
  );
  for (const file of [
    "account/README.md",
    "account/readme.md",
    "account/INDEX.md",
  ])
    assert.equal(
      (deriveEntryPath({ file, document: true, location }) as { path: string })
        .path,
      "account",
    );
});

test("declared paths replace derivation and variants require their own slug", () => {
  assert.deepEqual(
    deriveEntryPath({
      file: "deep/place/item.tsx",
      prefix: "specs",
      slug: "leaf",
      path: "other/Entry",
      location,
    }),
    { path: "other/Entry", slug: "leaf", index: false },
  );
  assert.deepEqual(
    deriveEntryPath({
      file: "item.mockup.tsx",
      parentPath: "account/invoice",
      slug: "overdue",
      location,
    }),
    { path: "account/invoice/overdue", slug: "overdue", index: false },
  );
  assert.equal(
    (
      deriveEntryPath({
        file: "item.tsx",
        parentPath: "account/invoice",
        location,
      }) as { code: string }
    ).code,
    "invalid-segment",
  );
});

test("grammar diagnostics retain exact fields and source attribution", () => {
  for (const slug of [
    "has space",
    "é",
    "a.b",
    "con",
    "AUX",
    "com9",
    "",
    "one/two",
    "a%20b",
  ])
    assert.deepEqual(deriveEntryPath({ file: "item.tsx", slug, location }), {
      code: "invalid-segment",
      message: `${location}: slug ${JSON.stringify(slug)} is not a valid path segment; use letters, digits, hyphens and underscores`,
    });
  for (const path of [
    "",
    "/one",
    "one/",
    "one//two",
    "../two",
    "a/b.n",
    "a/CON",
  ])
    assert.deepEqual(deriveEntryPath({ file: "item.tsx", path, location }), {
      code: "invalid-path",
      message: `${location}: path ${JSON.stringify(path)} is not a valid path`,
    });
  assert.equal(movedFromDiagnostic("old/invoice", location), undefined);
  assert.deepEqual(movedFromDiagnostic("../invoice", location), {
    code: "invalid-path",
    message: `${location}: movedFrom "../invoice" is not a valid path`,
  });
  assert.equal(
    (
      deriveEntryPath({ file: "Getting Started.mockup.tsx", location }) as {
        code: string;
      }
    ).code,
    "invalid-segment",
  );
});

const entry = (path: string, location: string, index = false) => ({
  path,
  location,
  slug: path.split("/").at(-1)!,
  index,
});

test("collisions are case-folded, attributed and independent of export order", () => {
  assert.deepEqual(
    pathCollisions([
      entry("account/invoice", "z export b"),
      entry("account/invoice", "a export default[0]"),
    ]),
    [
      {
        code: "duplicate-path",
        message:
          "path account/invoice is defined twice:\n  a export default[0]\n  z export b",
      },
    ],
  );
  assert.deepEqual(
    pathCollisions([entry("Invoice", "b"), entry("invoice", "a")]),
    [
      {
        code: "case-collision",
        message:
          "paths Invoice and invoice differ only by letter case:\n  a\n  b",
      },
    ],
  );
});

test("only variants and index pages allow a leaf above other entries", () => {
  const parent = entry("account/invoice", "invoice.mockup.tsx export default");
  const child = entry(
    "account/invoice/overdue",
    "invoice.mockup.tsx export default[1]",
  );
  assert.equal(pathCollisions([parent, child])[0]?.code, "duplicate-path");
  assert.deepEqual(
    pathCollisions([parent, { ...child, variantOf: parent.path }]),
    [],
  );
  assert.deepEqual(pathCollisions([{ ...parent, index: true }, child]), []);
});

test("case-only folder spellings fail even when their leaves differ", () => {
  assert.deepEqual(
    pathCollisions([
      entry("Account/invoice", "one"),
      entry("account/payment", "two"),
    ]),
    [
      {
        code: "case-collision",
        message:
          "paths Account and account differ only by letter case:\n  one\n  two",
      },
    ],
  );
});

test("declared paths bypass file and directory grammar but retain explicit slug checks", () => {
  const resolved = deriveEntryPath({
    file: "Bad Folder/a-->b.mockup.tsx",
    path: "account/Invoice",
    location,
  });
  assert.ok("path" in resolved);
  assert.equal(resolved.path, "account/Invoice");
  assert.equal(resolved.index, false);
  assert.deepEqual(
    deriveEntryPath({
      file: "Bad Folder/a-->b.mockup.tsx",
      path: "account/Invoice",
      slug: "bad slug",
      location,
    }),
    {
      code: "invalid-segment",
      message: `${location}: slug "bad slug" is not a valid path segment; use letters, digits, hyphens and underscores`,
    },
  );
});

test("declared index paths retain their own-folder link base, including reserved documents", async () => {
  const { entryLinkBase } = await import("../src/registry/path_derivation.js");
  for (const input of [
    { file: "Bad Folder/index.mockup.tsx" },
    { file: "Bad Folder/a-->b.mockup.tsx", slug: "index" },
    { file: "Bad Folder/README.md", document: true },
    { file: "Bad Folder/index.md", document: true },
  ]) {
    const resolved = deriveEntryPath({
      ...input,
      path: "account/billing",
      location,
    });
    assert.ok("path" in resolved);
    assert.equal(resolved.index, true);
    assert.equal(
      entryLinkBase(resolved.path, resolved.index),
      "account/billing",
    );
  }
});

test("a variant index slug never collapses or owns a folder", () => {
  const variant = deriveEntryPath({
    file: "invoice.mockup.tsx",
    slug: "index",
    parentPath: "account/invoice",
    location,
  });
  assert.ok("path" in variant);
  assert.equal(variant.index, false);
  assert.equal(
    pathCollisions([
      { ...variant, location, variantOf: "account/invoice" },
      entry("account/invoice/index/child", "child"),
    ])[0]?.code,
    "duplicate-path",
  );
});
