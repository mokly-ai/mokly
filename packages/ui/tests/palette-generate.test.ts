import assert from "node:assert/strict";
import { test } from "node:test";

import { generatePaletteStylesheets } from "../scripts/palette-generate.mjs";

const THEME = "packages/ui/src/theme/theme.css";
const DOCUMENT = "crates/mokly-html/src/document_palette.css";

/** Two generated stylesheets, as the generator formats them. */
const STYLESHEETS = [
  { path: THEME, css: ".mbk {\n  --chrome-ink: #0d1410;\n}\n" },
  { path: DOCUMENT, css: "html {\n  --document-ink: #0d1410;\n}\n" },
];

/**
 * One generator run against committed files held in memory, with its exit
 * status, the files it wrote, and the lines it reported.
 */
async function run(check: boolean, committed: Record<string, string>) {
  const written: string[] = [];
  const reported: string[] = [];
  const status = await generatePaletteStylesheets({
    check,
    stylesheets: STYLESHEETS,
    read: async (path) => committed[path],
    write: async (path) => {
      written.push(path);
    },
    report: (line) => {
      reported.push(line);
    },
  });
  return { status, written, reported };
}

test("a check names each stylesheet that differs or is missing, writes nothing, and fails", async () => {
  const { status, written, reported } = await run(true, {
    [THEME]: ".mbk {\n  --chrome-ink: #1a1d1c;\n}\n",
  });
  assert.equal(status, 1);
  assert.deepEqual(reported, [
    "[palette] packages/ui/src/theme/theme.css differs from packages/ui/src/palette/palette.ts; run npm run palette:generate and commit the result",
    "[palette] crates/mokly-html/src/document_palette.css is missing; run npm run palette:generate and commit the result",
  ]);
  assert.deepEqual(written, []);
});

test("a check of stylesheets that match their committed files reports nothing and passes", async () => {
  const { status, written, reported } = await run(true, {
    [THEME]: ".mbk {\n  --chrome-ink: #0d1410;\n}\n",
    [DOCUMENT]: "html {\n  --document-ink: #0d1410;\n}\n",
  });
  assert.equal(status, 0);
  assert.deepEqual(reported, []);
  assert.deepEqual(written, []);
});

test("generating writes each stylesheet that differs from its committed file, and only those", async () => {
  const { status, written } = await run(false, {
    [THEME]: ".mbk {\n  --chrome-ink: #1a1d1c;\n}\n",
    [DOCUMENT]: "html {\n  --document-ink: #0d1410;\n}\n",
  });
  assert.equal(status, 0);
  assert.deepEqual(written, [THEME]);
});
