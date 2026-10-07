import assert from "node:assert/strict";
import test from "node:test";

import { validateExportReferences } from "../dist/export/references.js";

const source = "mokly-viewer/client/app.js";

test("export ignores import-like prose, comments, templates and regular expressions", () => {
  assert.doesNotThrow(() =>
    validateExportReferences(
      new Map([
        [
          source,
          `
          const text = 'Copied from "Draft"';
          const template = \`Copied from "Template"\`;
          const pattern = /from "Pattern"/;
          // import "./comment.js"
          /* export { x } from "./block-comment.js"; */
          const meta = import.meta.url;
        `,
        ],
      ]),
    ),
  );
});

for (const [description, content, destination] of [
  ["static import", 'import{a}from"./chunk+1.js";', "./chunk+1.js"],
  ["side-effect import", 'import"./side+1.js";', "./side+1.js"],
  ["re-export", 'export{a}from"./exports+1.js";', "./exports+1.js"],
  ["star re-export", 'export*from"./star+1.js";', "./star+1.js"],
  ["dynamic import", 'import("./lazy+1.js");', "./lazy+1.js"],
  ["template import", "import(`./template+1.js`);", "./template+1.js"],
  [
    "import separated by comments",
    'import/* comment */"./comment+1.js";',
    "./comment+1.js",
  ],
  [
    "escaped specifier",
    String.raw`import "./escaped\u002b1.js";`,
    "./escaped+1.js",
  ],
] as const) {
  test(`export checks every ${description} against the final inventory`, () => {
    const files = new Map([[source, content]]);
    assert.throws(() => validateExportReferences(files), {
      code: "export-invalid",
      detail: `Export resource is unavailable: ${source} -> ${destination}`,
    });
    files.set(
      `mokly-viewer/client/${destination.slice(2)}`,
      "export const a=1;",
    );
    validateExportReferences(files);
  });
}

test("export validates relative module specifiers containing a colon", () => {
  assert.throws(
    () =>
      validateExportReferences(
        new Map([[source, 'import{a}from"./chunk:1.js";']]),
      ),
    {
      code: "export-invalid",
      detail: "Export URL escapes the site: ./chunk:1.js",
    },
  );
});

test("export reports a module lexer failure with the script path", () => {
  assert.throws(
    () =>
      validateExportReferences(
        new Map([[source, 'import "./unterminated.js']]),
      ),
    {
      code: "export-invalid",
      detail: `Could not read export module references: ${source}`,
    },
  );
});
