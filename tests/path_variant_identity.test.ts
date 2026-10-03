import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";
import { deriveEntryPath } from "../dist/registry/path_derivation.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const kind of ["screen", "component"] as const)
  test(`${kind} variants reject an authored path as an unknown input`, async (t) => {
    const source =
      kind === "screen"
        ? `import {defineScreen} from '@mokly/mokly';export default defineScreen({path:'account/invoice',title:'Invoice',description:'Invoice',dependencies:[],relatedDocs:[],mobile:'Invoice',desktop:'Invoice',variants:[{slug:'overdue',path:'other/place',title:'Overdue',description:'Overdue',mobile:'Overdue',desktop:'Overdue'}]});`
        : `import {defineComponent} from '@mokly/mokly';export default defineComponent({path:'account/invoice',title:'Invoice',description:'Invoice',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Invoice',variants:[{slug:'overdue',path:'other/place',title:'Overdue',props:{}}]});`;
    const fixture = await pathFixture({ "specs/item.mockup.ts": source });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), /unknown field path/);
  });

test("a parent's declared path owns every variant path and link base", async (t) => {
  const fixture = await pathFixture({
    "specs/Bad Folder/Bad Name.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly';export default defineScreen({path:'account/invoice',title:'Invoice',description:'Invoice',dependencies:[],relatedDocs:[],mobile:'Invoice',desktop:'Invoice',variants:[{slug:'index',title:'Index state',description:'State',mobile:<MockLink to='./details'>Details</MockLink>,desktop:'State'}]});`,
    "specs/details.mockup.ts": pageSource('path:"account/details",'),
  });
  t.after(fixture.remove);
  const compiled = await fixture.compile();
  assert.deepEqual(
    compiled.manifest.entries
      .filter((entry) => entry.kind === "screen")
      .map((entry) => entry.path),
    ["account/invoice", "account/invoice/index"],
  );
  assert.match(
    compiled.outputs.get("account/invoice/index/index.mobile.html")!,
    /data-mokly-link="account\/details"/,
  );
  const derived = deriveEntryPath({
    file: "index.mockup.ts",
    location: "specs/index.mockup.ts",
    slug: "index",
    parentPath: "account/invoice",
  });
  assert.deepEqual(derived, {
    path: "account/invoice/index",
    slug: "index",
    index: false,
  });
});

for (const variantPath of ["elsewhere/empty", "product/browse/home/deep/empty"])
  test(`both readers reject a variant outside its direct parent: ${variantPath}`, () => {
    const base = {
      kind: "screen",
      title: "Home",
      description: "Home",
      sourcePath: "specs/home.mockup.ts",
      declaredDependencies: [],
      relatedDocs: [],
      colorSchemes: ["light"],
      useCasePaths: [],
    };
    assert.throws(
      () =>
        parseManifest({
          schemaVersion: 8,
          generatedBy: "mokly",
          folders: [],
          sourceFiles: [base.sourcePath],
          entries: [
            { ...base, path: "product/browse/home" },
            { ...base, path: variantPath, variantOf: "product/browse/home" },
          ],
        }),
      /variant path must be parent path plus one segment/,
    );
    const model = JSON.parse(
      fs.readFileSync(
        new URL("../docs/protocol/fixtures/catalogue-v4.json", import.meta.url),
        "utf8",
      ),
    );
    const variant = model.screens.find(
      (entry: { variantOf?: string }) =>
        entry.variantOf === "product/browse/home",
    );
    const old = variant.path;
    variant.path = variantPath;
    const replace = (nodes: Array<{ path: string; children?: unknown[] }>) => {
      for (const node of nodes) {
        if (node.path === old) node.path = variantPath;
        if (node.children) replace(node.children as typeof nodes);
      }
    };
    replace(model.tree);
    assert.throws(
      () => readCatalogue(model),
      /variant path must be parent path plus one segment/,
    );
  });

test("a public variant cannot become a folder page", () => {
  const model = JSON.parse(
    fs.readFileSync(
      new URL("../docs/protocol/fixtures/catalogue-v4.json", import.meta.url),
      "utf8",
    ),
  );
  const variant = model.screens.find(
    (entry: { variantOf?: string }) =>
      entry.variantOf === "product/browse/home",
  );
  const child = { ...model.pages[0], path: `${variant.path}/child` };
  model.pages.push(child);
  const attach = (nodes: Array<{ path: string; children?: unknown[] }>) => {
    for (const node of nodes) {
      if (node.path === variant.path)
        node.children = [{ kind: "entry", path: child.path }];
      else if (node.children) attach(node.children as typeof nodes);
    }
  };
  attach(model.tree);
  assert.throws(() => readCatalogue(model), /variant cannot have children/);
});
