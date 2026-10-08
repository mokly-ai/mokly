import assert from "node:assert/strict";
import test from "node:test";

import { DEFINITION } from "../dist/authoring/markers.js";
import { definePage, defineFolder } from "../dist/index.js";
import { collectModuleExports } from "../dist/registry/export_collection.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { projectCatalogue } from "../src/catalogue/projection.js";

import { textOutput } from "./helpers/generated_text.js";
import { pathFixture, pageSource } from "./helpers/path_fixture.js";

const page = () =>
  definePage({
    title: "Page",
    description: "A page",
    relatedDocs: [],
    render: () => "<html><body>Page</body></html>",
  });

test("export collection accepts default, named and array definitions and ignores helpers", () => {
  const a = page(),
    b = page(),
    folder = defineFolder({ path: "account" });
  assert.deepEqual(
    collectModuleExports(
      {
        default: a,
        another: [b, folder],
        helper: () => 1,
        data: { kind: "page" },
        number: 1,
      },
      "specs/a.tsx",
    ).map(({ definition, location }) => [definition, location]),
    [
      [a, "specs/a.tsx export default"],
      [b, "specs/a.tsx export another[0]"],
      [folder, "specs/a.tsx export another[1]"],
    ],
  );
  assert.throws(
    () => collectModuleExports({ helper: () => 1 }, "specs/empty.ts"),
    /\[empty-module\] specs\/empty.ts exports no Mokly definition/,
  );
  assert.throws(
    () => collectModuleExports({ default: [[a]] }, "specs/nested.ts"),
    /\[nested-array\] specs\/nested.ts export default\[0\]: nested arrays are not definitions/,
  );
  assert.equal(
    collectModuleExports(
      { bad: { [DEFINITION]: true, kind: "forged" } },
      "specs/forged.ts",
    ).length,
    1,
  );
});

test("several exports derive distinct slugs without assigning meaning to export names", async (t) => {
  const fixture = await pathFixture({
    "specs/account/index.mockup.tsx": `import {definePage} from '@mokly/mokly'; const fields={title:'Account',description:'The account',relatedDocs:[],render:()=>'<html><body>Account</body></html>'}; export default definePage(fields); export const other=definePage({...fields,slug:'settings'}); export const helper=42;`,
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.deepEqual(
    built.manifest.entries.map((entry) => entry.path),
    ["account", "account/settings"],
  );
  assert.equal(built.outputs.has("account/index.html"), true);
  assert.equal(built.outputs.has("account/settings/index.html"), true);
});

test("a copied branded export fails with its export location", async (t) => {
  const fixture = await pathFixture({
    "specs/item.mockup.tsx":
      pageSource().replace(
        "export default definePage",
        "export const first = definePage",
      ) + "\nexport const second={...first};",
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[invalid-definition\] specs\/item.mockup.tsx: export second is not a Mokly definition/,
  );
});

test("component registrations collect their entries and typed links resolve before rendering", async (t) => {
  const fixture = await pathFixture({
    "specs/components/action.mockup.tsx": `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:'Action',description:'An action',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Action',variants:[{slug:'primary',title:'Primary',props:{}}]});`,
    "specs/account/invoice.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly'; export default defineScreen({title:'Invoice',description:'An invoice',relatedDocs:[],mobile:'Invoice',desktop:'Invoice',variants:[{slug:'overdue',title:'Overdue',description:'Overdue invoice',mobile:<MockLink to='./invoice'>Invoice</MockLink>,desktop:'Overdue'}]});`,
    "specs/account/links.mockup.tsx": `import {definePage,mockLink} from '@mokly/mokly'; import invoice from './invoice.mockup'; export default definePage({title:'Links',description:'Links to invoices',relatedDocs:[],render:()=> '<html><body><a href="'+mockLink(invoice)+'">Invoice</a></body></html>'});`,
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.deepEqual(
    built.manifest.entries.map((entry) => entry.path),
    [
      "components/action",
      "components/action/primary",
      "account/links",
      "account/invoice",
      "account/invoice/overdue",
    ],
  );
  assert.match(
    textOutput(built.outputs, "account/links/index.html")!,
    /href="\.\.\/invoice\/index.desktop.html" data-mokly-link="account\/invoice"/,
  );
  assert.equal(built.manifest.schemaVersion, 10);
  assert.equal(JSON.stringify(built.manifest).includes('"navPath"'), false);
});

test("one module collects aliases once and two modules cannot export one object", async (t) => {
  const fixture = await pathFixture({
    "helpers/shared.ts": pageSource(),
    "specs/account/invoice.mockup.ts":
      "export {default} from '../../helpers/shared'; export {default as invoice} from '../../helpers/shared';",
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.deepEqual(
    built.manifest.entries.map(({ path, sourcePath }) => ({
      path,
      sourcePath,
    })),
    [{ path: "account/invoice", sourcePath: "helpers/shared.ts" }],
  );
  await fixture.write(
    "specs/other.mockup.ts",
    "export {default} from '../helpers/shared';",
  );
  await assert.rejects(
    fixture.compile(),
    /\[duplicate-export\] definition Page is exported by two entry modules:\n {2}specs\/account\/invoice.mockup.ts export default\n {2}specs\/other.mockup.ts export default/,
  );
});

test("index component defaults use resolved path slugs and registration links resolve", async (t) => {
  const registration = (title: string) =>
    `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:${JSON.stringify(title)},description:'A reusable control',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=>${JSON.stringify(title)},variants:[{slug:'primary',title:'Primary',props:{}}]});`;
  const fixture = await pathFixture({
    "specs/components/alpha/index.mockup.tsx": registration("Alpha"),
    "specs/components/beta/index.mockup.tsx": registration("Beta"),
    "specs/home.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly'; import alpha from './components/alpha/index.mockup'; import beta from './components/beta/index.mockup'; const content=<main><alpha.Component/><beta.Component/></main>; export default defineScreen({title:'Home',description:'Both controls',relatedDocs:[],mobile:content,desktop:content});`,
  });
  t.after(fixture.remove);
  const result = await fixture.compile();
  const home = result.manifest.entries.find((entry) => entry.kind === "screen");
  assert.deepEqual(
    home?.componentViews?.[0]?.instances.map((instance) => instance.id).sort(),
    ["alpha", "beta"],
  );
  await fixture.write(
    "specs/links.mockup.tsx",
    `import {definePage,mockLink} from '@mokly/mokly'; import alpha from './components/alpha/index.mockup'; const href=mockLink(alpha); export default definePage({title:'Links',description:'A component link',relatedDocs:[],render:()=>'<html><body><a href="'+href+'">Alpha</a></body></html>'});`,
  );
  assert.match(
    textOutput((await fixture.compile()).outputs, "links/index.html")!,
    /data-mokly-link="components\/alpha"/,
  );
});

test("component variant field errors name the final path from the exporting module", async (t) => {
  const fixture = await pathFixture({
    "helpers/action.ts": `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:'Action',description:'An action',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Action',variants:[{slug:'primary',title:'Primary',props:{},unexpected:undefined}]});`,
    "specs/library/action/index.mockup.ts":
      "export {default} from '../../../helpers/action';",
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[invalid-field\].*\(library\/action\/primary\): unknown field unexpected/,
  );
});

for (const field of ["id", "navPath", "variantOf", "unexpected"])
  test(`unknown screen field ${field} is rejected like every other unknown input`, async (t) => {
    const fixture = await pathFixture({
      "specs/account/item.mockup.ts": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Item',description:'Item',relatedDocs:[],mobile:'Item',desktop:'Item',${field}:undefined});`,
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `[invalid-field] specs/account/item.mockup.ts (account/item): unknown field ${field}`,
        ),
    );
  });

for (const helper of ["definePage", "defineUseCase", "defineComponent"])
  test(`${helper} rejects an ordinary unknown input after path resolution`, async (t) => {
    const specific =
      helper === "definePage"
        ? "render:()=>'<html></html>'"
        : helper === "defineUseCase"
          ? "steps:[{screenPath:'screen'}]"
          : "propSchema:{kind:'object',properties:{}},render:()=>null,variants:[{slug:'primary',title:'Primary',props:{}}]";
    const fixture = await pathFixture({
      "specs/entry.mockup.ts": `import {${helper},defineScreen} from '@mokly/mokly'; const fields={title:'Entry',description:'Entry',relatedDocs:[]}; export default ${helper}({...fields,unexpected:undefined,${specific}}); export const screen=defineScreen({...fields,slug:'screen',mobile:'Screen',desktop:'Screen',useCasePaths:${helper === "defineUseCase" ? "['entry']" : "[]"}});`,
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      /\[invalid-field\].*unknown field unexpected/,
    );
  });

for (const [step, message] of [
  ["null", "step #1 needs a non-empty screenPath"],
  [
    "{screenPath:'screen',unexpected:undefined}",
    "step #1: unknown field unexpected",
  ],
])
  test(`flow step validation stays attributed: ${step}`, async (t) => {
    const fixture = await pathFixture({
      "specs/flow.mockup.ts": `import {defineUseCase,defineScreen} from '@mokly/mokly'; const fields={title:'Entry',description:'Entry',relatedDocs:[]}; export default defineUseCase({...fields,steps:[${step}]}); export const screen=defineScreen({...fields,slug:'screen',mobile:'Screen',desktop:'Screen',useCasePaths:['flow']});`,
    });
    t.after(fixture.remove);
    await assert.rejects(
      fixture.compile(),
      (error: unknown) =>
        error instanceof Error && error.message.includes(message!),
    );
  });

test("explicit instance names keep their own kebab grammar independently of entry paths", async (t) => {
  const fixture = await pathFixture({
    "specs/controls.mockup.tsx": `import {defineComponent,defineScreen} from '@mokly/mokly'; const fields={title:'Action',description:'Action',relatedDocs:[]}; const action=defineComponent({...fields,slug:'Action_Control',propSchema:{kind:'object',properties:{}},render:()=> 'Action',variants:[{slug:'default',title:'Default',props:{}}]}); export const components=action.entries; export default defineScreen({...fields,slug:'screen',mobile:<action.Component moklyInstance='con'/>,desktop:<action.Component/>});`,
  });
  t.after(fixture.remove);
  const manifest = (await fixture.compile()).manifest;
  const screen = manifest.entries.find((entry) => entry.kind === "screen");
  assert.equal(screen?.componentViews?.[0]?.instances[0]?.id, "con");
  assert.equal(screen?.componentViews?.[1]?.instances[0]?.id, "Action_Control");
  const publicModel = projectCatalogue({
    catalogue: createCatalogue(manifest),
    configPath: "mokly.config.ts",
    changesStatus: "unavailable",
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  assert.doesNotThrow(() => readCatalogue(publicModel));
});

test("a declared path bypasses only its own file-derived identity", async (t) => {
  const fixture = await pathFixture({
    "specs/Bad Folder/Bad Name.mockup.ts": pageSource('path:"account/item",'),
  });
  t.after(fixture.remove);
  assert.equal(
    (await fixture.compile()).manifest.entries[0]?.path,
    "account/item",
  );
  await fixture.write(
    "specs/Bad Folder/Bad Name.mockup.ts",
    pageSource('path:"account/item",') +
      "\nexport const other=definePage({title:'Other',description:'Other',relatedDocs:[],render:()=>'<html></html>'});",
  );
  await assert.rejects(
    fixture.compile(),
    /\[invalid-segment\] specs\/Bad Folder\/Bad Name.mockup.ts export other: file name "Bad Name"/,
  );
});
