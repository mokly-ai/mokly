import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { readCatalogueIndex } from "@mokly/viewer";

import { scratchDirectory } from "../../_tests_/scratch.mjs";
import {
  catalogueSections,
  catalogueTrail,
  stagedEntry,
} from "../scripts/stage/catalogue.js";
import { repositoryPath } from "../src/workspace.js";

const execute = promisify(execFile);

/** Real definitions exercise index owners, section ordering and authored variants. */
test("stage rows match a real catalogue index with index titles, folder order and variants", async (t) => {
  const root = scratchDirectory(repositoryPath(".context/stage-tree-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  };
  await write(".gitignore", "build/\nts/node_modules/\n");
  await write("package.json", '{"private":true}');
  await symlink(
    repositoryPath("node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  await write(
    "mokly.config.json",
    JSON.stringify({
      repoRoot: ".",
      roots: [{ dir: "entries", files: ["**/*.mockup.tsx"] }],
      moduleResolution: { packageRoots: ["ts"] },
    }),
  );
  await write("entries/_folder.json", '{"order":["product","..."]}');
  await write(
    "entries/product/index.mockup.tsx",
    `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Product home',description:'Fixture',relatedDocs:[],render:()=> <main>Product</main>,variants:[{slug:'empty',title:'Empty',props:{}}]});`,
  );
  await write(
    "entries/product/account/project-created.mockup.tsx",
    `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Project created',description:'Fixture',relatedDocs:[],render:()=> <main>Created</main>});`,
  );
  await write(
    "entries/design/_folder.json",
    '{"title":"Toolkit","order":["notice","button","..."]}',
  );
  await write(
    "entries/design/intro.mockup.tsx",
    `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Intro',description:'Fixture',relatedDocs:[],render:()=> <main>Intro</main>});`,
  );
  const component = (title: string) =>
    `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:'${title}',description:'Fixture',relatedDocs:[],propSchema:{type:'object',properties:{},additionalProperties:false},props:{},render:()=> <span>Component</span>,variants:[{slug:'quiet',title:'Quiet',props:{}},{slug:'primary',title:'Primary',props:{}}]});`;
  for (const name of ["button", "notice"])
    await write(
      `entries/design/${name}.mockup.tsx`,
      component(name === "button" ? "Button" : "Notice"),
    );
  await write("entries/product/part.mockup.tsx", component("Part"));
  await write("entries/design/hidden/_folder.json", '{"hidden":true}');
  await write("entries/design/hidden/extra.mockup.tsx", component("Extra"));
  await execute("git", ["init", "-b", "main"], { cwd: root });
  await execute(
    repositoryPath("node_modules/.bin/mokly"),
    ["build", "--strict", "--no-changes", "--out", "build"],
    { cwd: root },
  );
  const catalogue = readCatalogueIndex(
    JSON.parse(
      await readFile(path.join(root, "build/mokly-viewer/index.json"), "utf8"),
    ),
  );
  assert.equal(catalogue.schemaVersion, 9);
  const entries = [...catalogue.screens, ...catalogue.components];
  const current = "product/account/project-created";
  const screen = stagedEntry(entries, current);
  const actual = catalogueSections(entries, catalogue, screen);
  assert.deepEqual(actual[0], {
    title: "Specs",
    rows: [
      {
        path: "product",
        label: "Product home",
        kind: "screen",
        count: 2,
        current: false,
        depth: 0,
      },
      {
        path: "product/account",
        label: "Account",
        kind: "folder",
        count: 1,
        current: false,
        depth: 1,
      },
      {
        path: current,
        label: "Project created",
        kind: "screen",
        count: null,
        current: true,
        depth: 2,
      },
    ],
  });
  assert.deepEqual(actual[1], {
    title: "Components",
    rows: [
      {
        path: "product",
        label: "Product home",
        kind: "folder",
        count: 1,
        current: false,
        depth: 0,
      },
      {
        path: "product/part",
        label: "Part",
        kind: "component",
        count: 2,
        current: false,
        depth: 1,
      },
      {
        path: "product/part/quiet",
        label: "Quiet",
        kind: "component",
        count: null,
        current: false,
        depth: 2,
      },
      {
        path: "product/part/primary",
        label: "Primary",
        kind: "component",
        count: null,
        current: false,
        depth: 2,
      },
      {
        path: "design",
        label: "Toolkit",
        kind: "folder",
        count: 2,
        current: false,
        depth: 0,
      },
      {
        path: "design/notice",
        label: "Notice",
        kind: "component",
        count: 2,
        current: false,
        depth: 1,
      },
      {
        path: "design/notice/quiet",
        label: "Quiet",
        kind: "component",
        count: null,
        current: false,
        depth: 2,
      },
      {
        path: "design/notice/primary",
        label: "Primary",
        kind: "component",
        count: null,
        current: false,
        depth: 2,
      },
      {
        path: "design/button",
        label: "Button",
        kind: "component",
        count: 2,
        current: false,
        depth: 1,
      },
      {
        path: "design/button/quiet",
        label: "Quiet",
        kind: "component",
        count: null,
        current: false,
        depth: 2,
      },
    ],
  });
  assert.deepEqual(catalogueTrail(entries, catalogue, screen), [
    "Catalogue home",
    "Product home",
    "Account",
  ]);
  assert.ok(
    catalogueSections(entries, catalogue, screen, 2)[1]!.rows.length <= 2,
  );
});
