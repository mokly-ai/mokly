import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy, projectTree } from "@mokly/viewer/data";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { validateFolderRecord } from "../dist/registry/folder_records.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

const location = "specs/account/_folder.json";

test("folder record fields use exact diagnostics", () => {
  for (const [value, reason] of [
    [{ extra: true }, "unknown field extra"],
    [
      { title: " bad " },
      "title must be a nonempty string without leading or trailing whitespace",
    ],
    [{ hidden: "yes" }, "hidden must be a boolean"],
    [
      { order: ["a", "a"] },
      'order must be an array of segments with at most one "..." and no duplicates',
    ],
    [
      { order: ["...", "..."] },
      'order must be an array of segments with at most one "..." and no duplicates',
    ],
    [{ order: ["index"] }, "order cannot name index"],
    [
      { exclude: ["../outside"] },
      "exclude must be an array of safe relative globs",
    ],
  ] as const)
    assert.throws(
      () => validateFolderRecord(value, "account", location, location, true),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          `[mokly/build-invalid] [invalid-folder] ${location}: ${reason}`,
    );
  assert.throws(
    () =>
      validateFolderRecord(
        { title: "Home" },
        "",
        "specs/_folder.json",
        "specs/_folder.json",
        true,
      ),
    /title is not allowed at the top level/,
  );
});

test("directory and code records merge, order folders, and exclude files before derivation", async (t) => {
  const fixture = await pathFixture({
    "specs/_folder.json": JSON.stringify({ order: ["account"] }),
    "specs/account/_folder.json": JSON.stringify({
      title: "Billing & Payments",
      order: ["zebra", "...", "nested"],
      exclude: ["drafts/**"],
    }),
    "specs/account/index.mockup.ts": pageSource('title:"Account",'),
    "specs/account/zebra.mockup.ts": pageSource('title:"Zebra",'),
    "specs/account/apple.mockup.ts": pageSource('title:"Apple",'),
    "specs/account/nested/child.mockup.ts": pageSource(),
    "specs/account/drafts/Bad Name.mockup.ts": "throw new Error('excluded')",
    "specs/account/records.mockup.ts": `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'account/nested',title:'Nested docs'});`,
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.deepEqual(
    built.manifest.folders.map((record) => record.path),
    ["", "account", "account/nested"],
  );
  assert.ok(built.manifest.sourceFiles.includes("specs/account/_folder.json"));
  const hierarchy = analyzeHierarchy(
    built.manifest.entries,
    built.manifest.folders,
  ).hierarchy;
  const tree = projectTree(hierarchy);
  assert.equal(tree[0]?.kind, "folder");
  if (tree[0]?.kind !== "folder") return;
  assert.equal(tree[0].title, "Billing & Payments");
  assert.equal(tree[0].index, "account");
  assert.deepEqual(
    tree[0].children.map((node) => node.path),
    ["account", "account/zebra", "account/apple", "account/nested"],
  );
});

test("folder titles fall back to index titles then segment display text", () => {
  const entries = [
    { kind: "page", path: "account-billing", title: "My account" },
    { kind: "page", path: "account-billing/item", title: "Item" },
    { kind: "page", path: "API_docs/item", title: "Item" },
  ];
  const tree = analyzeHierarchy(entries).hierarchy.tree;
  assert.deepEqual(
    tree.map((node) => node.label),
    ["API docs", "My account"],
  );
});

test("hidden folder entries stay addressable with hidden tree metadata", async (t) => {
  const fixture = await pathFixture({
    "specs/account/_folder.json": '{"hidden":true}',
    "specs/account/item.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  const hierarchy = analyzeHierarchy(
    built.manifest.entries,
    built.manifest.folders,
  ).hierarchy;
  assert.equal(projectTree(hierarchy)[0]?.hidden, true);
  assert.ok(hierarchy.byPath.has("account/item"));
  assert.ok(built.outputs.has("account/item/index.html"));
});

test("duplicate, unused, unknown child, and malformed JSON records fail with locations", async (t) => {
  const fixture = await pathFixture({
    "specs/account/_folder.json": "{}",
    "specs/account/item.mockup.ts": pageSource(),
    "specs/records.mockup.ts": `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'account'});`,
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[duplicate-folder\] folder account is defined twice:\n {2}specs\/account\/_folder.json\n {2}specs\/records.mockup.ts export default/,
  );
  await fixture.write(
    "specs/records.mockup.ts",
    `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'unused'});`,
  );
  await assert.rejects(
    fixture.compile(),
    /\[unused-folder\] specs\/records.mockup.ts export default describes folder unused, but no entry is below it/,
  );
  await fixture.write("specs/records.mockup.ts", pageSource());
  await fixture.write("specs/account/_folder.json", '{"order":["missing"]}');
  await assert.rejects(
    fixture.compile(),
    /\[unknown-folder-child\] specs\/account\/_folder.json: order names missing, which is not a child of account/,
  );
  await fixture.write("specs/account/_folder.json", "{broken");
  await assert.rejects(
    fixture.compile(),
    /\[invalid-folder\] specs\/account\/_folder.json: invalid JSON:/,
  );
});

for (const kind of ["screen", "component"] as const) {
  for (const carrier of ["directory", "code"] as const)
    test(`${kind} index folders reject ${carrier} record titles with the exact diagnostic`, async (t) => {
      const source =
        kind === "screen"
          ? `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Account screen',description:'Account',dependencies:[],relatedDocs:[],mobile:'Account',desktop:'Account'});`
          : `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:'Account component',description:'Account',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Account',variants:[{slug:'primary',title:'Primary',props:{}}]});`;
      const filename =
        carrier === "directory"
          ? "specs/account/_folder.json"
          : "specs/folders.mockup.ts";
      const fixture = await pathFixture({
        "specs/account/index.mockup.ts": source,
        "specs/account/child.mockup.ts": pageSource(),
        [filename]:
          carrier === "directory"
            ? '{"title":"Wrong title"}'
            : `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'account',title:'Wrong title'});`,
      });
      t.after(fixture.remove);
      const location = `${filename}${carrier === "code" ? " export default" : ""}`;
      await assert.rejects(
        fixture.compile(),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes(
            `[invalid-folder] ${location}: title cannot be set for a folder whose own page is a screen or component; set the entry's title`,
          ),
      );
      await fixture.write(
        filename,
        carrier === "directory"
          ? '{"order":["child"],"hidden":false}'
          : `import {defineFolder} from '@mokly/mokly'; export default defineFolder({path:'account',order:['child'],hidden:false});`,
      );
      const built = await fixture.compile();
      const hierarchy = analyzeHierarchy(
        built.manifest.entries,
        built.manifest.folders,
      ).hierarchy;
      assert.deepEqual(hierarchy.ancestorsByPath.get("account/child"), [
        `Account ${kind}`,
      ]);
      assert.equal(hierarchy.tree[0]?.label, `Account ${kind}`);
    });
}

for (const slug of ["_", "---"]) {
  test(`symbol-only folder ${slug} remains readable through the public catalogue`, async (t) => {
    const fixture = await pathFixture({
      [`specs/${slug}/item.mockup.ts`]: pageSource(),
    });
    t.after(fixture.remove);
    const { manifest } = await fixture.compile();
    const model = readCatalogue(
      projectCatalogue({
        catalogue: createCatalogue(manifest),
        configPath: "mokly.config.ts",
        changesStatus: "unavailable",
        comparisonUrl: null,
        revision: { content: 0, evidence: 0 },
      }),
    );
    const folder = model.tree[0];
    assert.equal(folder?.kind, "folder");
    if (folder?.kind !== "folder") throw new Error("Missing folder");
    assert.equal(folder.title, slug);
    assert.equal(folder.path, slug);
  });
}
