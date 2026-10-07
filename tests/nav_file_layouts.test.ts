import assert from "node:assert/strict";
import test from "node:test";

import { projectTree } from "@mokly/viewer/data";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { catalogueNavSections } from "../packages/viewer/dist/shell/nav_model.js";

import { pathFixture } from "./helpers/path_fixture.js";

const invoice = `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Invoice',description:'Invoice',relatedDocs:[],mobile:'Invoice',desktop:'Invoice',variants:[{slug:'overdue',title:'Overdue',description:'Overdue',mobile:'Overdue',desktop:'Overdue'}]});`;
const plans = `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Plans',description:'Plans',relatedDocs:[],mobile:'Plans',desktop:'Plans'});`;

/** Compile one file layout through the registry and project its rows. */
async function compiled(t: test.TestContext, file: string) {
  const fixture = await pathFixture({
    [file]: invoice,
    "specs/billing/plans.mockup.ts": plans,
  });
  t.after(fixture.remove);
  const { manifest } = await fixture.compile();
  const catalogue = createCatalogue(manifest);
  return {
    rows: catalogueNavSections(catalogue),
    sources: manifest.entries.map(({ path, sourcePath }) => [path, sourcePath]),
    tree: projectTree(catalogue.hierarchy),
  };
}

test("a screen with variants renders identically from either file layout", async (t) => {
  const flat = await compiled(t, "specs/billing/invoice.mockup.ts");
  const index = await compiled(t, "specs/billing/invoice/index.mockup.ts");
  assert.deepEqual(flat.sources, [
    ["billing/invoice", "specs/billing/invoice.mockup.ts"],
    ["billing/invoice/overdue", "specs/billing/invoice.mockup.ts"],
    ["billing/plans", "specs/billing/plans.mockup.ts"],
  ]);
  assert.deepEqual(index.sources, [
    ["billing/invoice", "specs/billing/invoice/index.mockup.ts"],
    ["billing/invoice/overdue", "specs/billing/invoice/index.mockup.ts"],
    ["billing/plans", "specs/billing/plans.mockup.ts"],
  ]);
  assert.deepEqual(flat.rows, index.rows);
  assert.deepEqual(flat.tree, index.tree);
  const billing = flat.rows[0]?.children[0];
  assert.ok(billing?.kind === "group");
  const row = billing.children.find(
    (node) => node.key === "entry:billing/invoice",
  );
  assert.ok(row?.kind === "leaf");
  assert.deepEqual(
    row.variants?.map(({ entryId }) => entryId),
    ["billing/invoice/overdue"],
  );
});
