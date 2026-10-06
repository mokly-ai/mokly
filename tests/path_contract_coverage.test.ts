import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy } from "@mokly/viewer/data";

import { validateFolderRecord } from "../packages/mokly/dist/registry/folder_records.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { buildNavSections } from "../packages/viewer/dist/shell/nav_tree.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

const screen = `import {defineScreen} from '@mokly/mokly'; export default defineScreen({
 title:'Invoice', description:'Invoice', dependencies:[], relatedDocs:[], mobile:'Invoice', desktop:'Invoice',
 variants:[{slug:'overdue',title:'Overdue',description:'Overdue',mobile:'Overdue',desktop:'Overdue'}]
});`;

test("an entry module names its invalid directory segment exactly", async (t) => {
  const fixture = await pathFixture({
    "specs/My Dir/page.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    message:
      '[mokly/build-invalid] catalogue is invalid:\n- [invalid-segment] specs/My Dir/page.mockup.ts export default: directory name "My Dir" is not a valid path segment; use letters, digits, hyphens and underscores',
  });
});

test("unknown link diagnostics retain their export location and resolved path", async (t) => {
  const fixture = await pathFixture({
    "specs/account/links.mockup.ts": pageSource(
      "",
      '<html><body><a href="mock:./missing">Missing</a></body></html>',
    ),
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    message:
      "[mokly/build-invalid] [unknown-link-target] specs/account/links.mockup.ts export default: link target account/missing does not exist",
  });
});

test("a screen beside its variants and a directory index render identical rows", async (t) => {
  const leaf = await pathFixture({ "specs/invoice.mockup.ts": screen });
  const index = await pathFixture({ "specs/invoice/index.mockup.ts": screen });
  t.after(leaf.remove);
  t.after(index.remove);
  const first = createCatalogue((await leaf.compile()).manifest);
  const second = createCatalogue((await index.compile()).manifest);
  assert.deepEqual(
    buildNavSections(first.hierarchy),
    buildNavSections(second.hierarchy),
  );
  assert.deepEqual(
    [...first.hierarchy.ancestorsByPath],
    [...second.hierarchy.ancestorsByPath],
  );
  assert.deepEqual([...first.byPath.keys()], ["invoice", "invoice/overdue"]);
});

test("hyphens become spaces in the default folder title", () => {
  const hierarchy = analyzeHierarchy([
    { kind: "page", path: "account-billing/invoice", title: "Invoice" },
  ]).hierarchy;
  assert.equal(hierarchy.tree[0]?.label, "Account billing");
  assert.deepEqual(hierarchy.ancestorsByPath.get("account-billing/invoice"), [
    "Account billing",
  ]);
});

test("equivalent directory and definition carriers emit one equivalent folder record", async (t) => {
  const fields = {
    title: "Account & billing",
    order: ["zebra", "..."],
    hidden: true,
  };
  const entries = {
    "specs/account/zebra.mockup.ts": pageSource('title:"Zebra",'),
    "specs/account/apple.mockup.ts": pageSource('title:"Apple",'),
  };
  const directory = await pathFixture({
    ...entries,
    "specs/account/_folder.json": JSON.stringify(fields),
  });
  const definition = await pathFixture({
    ...entries,
    "specs/folders.mockup.ts": `import {defineFolder} from '@mokly/mokly';export default defineFolder(${JSON.stringify({ path: "account", ...fields })});`,
  });
  t.after(directory.remove);
  t.after(definition.remove);
  const manifests = [
    (await directory.compile()).manifest,
    (await definition.compile()).manifest,
  ];
  for (const [index, manifest] of manifests.entries()) {
    assert.equal(manifest.folders.length, 1);
    const { sourcePath, ...record } = manifest.folders[0]!;
    assert.equal(
      sourcePath,
      index === 0 ? "specs/account/_folder.json" : "specs/folders.mockup.ts",
    );
    assert.deepEqual(record, { path: "account", ...fields });
  }
  assert.deepEqual(
    buildNavSections(createCatalogue(manifests[0]!).hierarchy),
    buildNavSections(createCatalogue(manifests[1]!).hierarchy),
  );
});

for (const [field, value] of [
  ["title", "Root"],
  ["hidden", true],
  ["hidden", false],
  ["title", undefined],
  ["hidden", undefined],
] as const)
  test(`top-level folder rejects ${field}=${String(value)} with the exact reason`, () => {
    assert.throws(
      () =>
        validateFolderRecord(
          { [field]: value },
          "",
          "specs/_folder.json",
          "specs/_folder.json",
          true,
        ),
      {
        message: `[mokly/build-invalid] [invalid-folder] specs/_folder.json: ${field} is not allowed at the top level`,
      },
    );
  });
