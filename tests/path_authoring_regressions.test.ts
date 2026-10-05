import assert from "node:assert/strict";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

const fields =
  "title:'Invoice',description:'An invoice',dependencies:[],relatedDocs:[],mobile:'Invoice',desktop:'Invoice'";
const variants =
  "[{slug:'first',title:'First',description:'First state',mobile:'First',desktop:'First'},{slug:'second',title:'Second',description:'Second state',mobile:'Second',desktop:'Second'}]";

test("ordinary nested helper arrays are ignored beside definitions", async (t) => {
  const fixture = await pathFixture({
    "specs/item.mockup.ts":
      pageSource() + "\nexport const rows = [['Name','Price']];",
  });
  t.after(fixture.remove);
  assert.equal((await fixture.compile()).manifest.entries.length, 1);
});

test("copied branded definitions cannot acquire another path or retarget links", async (t) => {
  const fixture = await pathFixture({
    "specs/item.mockup.ts":
      pageSource().replace(
        "export default definePage",
        "export const first=definePage",
      ) + "\nexport const second={...first,slug:'second'};",
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[invalid-definition\] specs\/item.mockup.ts: export second is not a Mokly definition/,
  );
});

test("duplicate exports produce one diagnostic without path or folder noise", async (t) => {
  const fixture = await pathFixture({
    "helpers/shared.ts": pageSource(),
    "specs/one.mockup.ts": "export {default} from '../helpers/shared';",
    "specs/two.mockup.ts": "export {default} from '../helpers/shared';",
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /\[duplicate-export\]/);
    assert.equal(
      (error.message.match(/\n- \[/g) ?? []).length,
      1,
      error.message,
    );
    return true;
  });
});

test("variant order follows its declaration despite named aliases", async (t) => {
  const fixture = await pathFixture({
    "specs/invoice.mockup.ts": `import {defineScreen} from '@mokly/mokly';const invoice=defineScreen({${fields},variants:${variants}});export const another=invoice[2];export default invoice;`,
  });
  t.after(fixture.remove);
  assert.deepEqual(
    (await fixture.compile()).manifest.entries.map((e) => e.path),
    ["invoice", "invoice/first", "invoice/second"],
  );
});

for (const [helper, field] of [
  ["definePage", "fragments"],
  ["definePage", "variants"],
  ["defineScreen", "variantOf"],
  ["defineFolder", "kind"],
  ["defineFolder", "definedIn"],
  ["defineFolder", "__viaDefine"],
] as const)
  test(`unknown ${helper} field ${field} has one general diagnostic`, async (t) => {
    const input =
      helper === "definePage"
        ? "title:'Page',description:'Page',dependencies:[],relatedDocs:[],render:()=>'<html><body>Page</body></html>'"
        : helper === "defineScreen"
          ? fields
          : "path:'group'";
    const fixture = await pathFixture({
      "specs/entry.mockup.ts": `import {${helper}} from '@mokly/mokly';export default ${helper}({${input},${field}:null});`,
      "specs/group/child.mockup.ts": pageSource(),
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(`unknown field ${field}`));
      assert.equal(
        (
          error.message.match(
            /\[(?:invalid-field|invalid-folder|invalid-variants|invalid-variant-of|invalid-page-field)\]/g,
          ) ?? []
        ).length,
        1,
        error.message,
      );
      return true;
    });
  });

test("non-string use-case paths fail with attributed metadata errors", async (t) => {
  const fixture = await pathFixture({
    "specs/invoice.mockup.ts": `import {defineScreen} from '@mokly/mokly';export default defineScreen({${fields},useCasePaths:[Symbol('x')]});`,
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /specs\/invoice.mockup.ts \(invoice\): useCasePaths/,
  );
});

test("persisted flow steps reject every undeclared key", async (t) => {
  const fixture = await pathFixture({
    "specs/invoice.mockup.ts": `import {defineScreen,defineUseCase} from '@mokly/mokly';export default defineScreen({${fields},useCasePaths:['tour']});export const tour=defineUseCase({slug:'tour',title:'Tour',description:'Tour',dependencies:[],relatedDocs:[],steps:[{screenPath:'invoice'}]});`,
  });
  t.after(fixture.remove);
  const manifest = (await fixture.compile()).manifest;
  const flow = manifest.entries.find((e) => e.kind === "use-case")!;
  for (const key of ["screenId", "unexpected"])
    assert.throws(
      () =>
        parseManifest({
          ...manifest,
          entries: manifest.entries.map((e) =>
            e === flow
              ? {
                  ...flow,
                  steps: [{ screenPath: "invoice", [key]: "invoice" }],
                }
              : e,
          ),
        }),
      new RegExp(`step #1 has unsupported ${key}`),
    );
});

test("raw internal-looking reference tokens are not authored paths", async (t) => {
  const fixture = await pathFixture({
    "specs/item.mockup.ts": pageSource(
      "",
      '<html><body><a href="mock:~definition-0">Invalid</a></body></html>',
    ),
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /invalid mock link|invalid logical|malformed|invalid mock:/i,
  );
});

test("unexported typed links name the referenced title and defining module", async (t) => {
  const fixture = await pathFixture({
    "helpers/hidden.ts": pageSource('title:"Hidden page",'),
    "specs/links.mockup.ts": `import {definePage,mockLink} from '@mokly/mokly';import hidden from '../helpers/hidden';const href=mockLink(hidden);export default definePage({title:'Links',description:'Links',dependencies:[],relatedDocs:[],render:()=>'<html><body><a href="'+href+'">Hidden</a></body></html>'});`,
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /\[unknown-link-target\] specs\/links.mockup.ts export default: referenced definition Hidden page from helpers\/hidden.ts is not exported by an entry module/,
  );
});

test("unknown relationship and attribution input keys cannot affect registry validation", async (t) => {
  for (const field of ["variantOf", "definedIn"]) {
    const fixture = await pathFixture({
      "specs/item.mockup.ts": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({${fields},${field}:'missing'});`,
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), (error: unknown) => {
      assert.ok(error instanceof Error);
      const diagnostics = error.message
        .split("\n")
        .filter((line) => line.startsWith("- ["));
      assert.equal(diagnostics.length, 1, error.message);
      assert.match(diagnostics[0]!, new RegExp(`unknown field ${field}$`));
      return true;
    });
  }
});
