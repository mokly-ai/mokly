import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../src/build/check.js";
import { compileCatalogue } from "../src/build/compile.js";
import { writeCompilation } from "../src/build/transaction.js";
import { loadConfig } from "../src/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const metadata =
  'dependencies: [], relatedDocs: [], description: "Document", title: "Handbook", id: "handbook"';
const document =
  '<!doctype html><html lang="en"><head><title>Handbook</title></head><body><main id="overview">Whole document</main></body></html>';
const pageSource = (extra = "", render = `() => ${JSON.stringify(document)}`) =>
  `import { definePage } from "@mokly/mokly"; export const mockups = [definePage({ ${metadata}, route: "app/handbook.html", render: ${render}, ${extra} })];`;

test("a page renders exactly one complete document even with dark screens enabled", async (context) => {
  const fixture = await createFixture(pageSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const result = await compileCatalogue(config);
  assert.deepEqual([...result.outputs.keys()].sort(), [
    "app/handbook.html",
    "mokly-manifest.json",
  ]);
  assert.equal(result.manifest.schemaVersion, 5);
  assert.equal("legacyPages" in result.manifest, false);
  assert.match(
    textOutput(result.outputs, "app/handbook.html") ?? "",
    /Whole document/,
  );
  await writeCompilation(result, config);
  checkCompilation(await compileCatalogue(config), config);
});

test("pages reject screen fields, asynchronous callbacks and incomplete documents", async (context) => {
  const fixture = await createFixture(pageSource());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const field of [
    "mobile",
    "desktop",
    "colorSchemes",
    "address",
    "useCaseIds",
    "steps",
    "childIds",
    "viewports",
    "fragments",
  ]) {
    await fs.promises.writeFile(
      fixture.entryPath,
      pageSource(`${field}: undefined`),
    );
    await assert.rejects(compileCatalogue(config), new RegExp(field));
  }
  for (const render of [
    'async () => "<html></html>"',
    '() => { throw new Error("render failed"); }',
    '() => "<main>fragment</main>"',
    "undefined",
  ]) {
    await fs.promises.writeFile(fixture.entryPath, pageSource("", render));
    await assert.rejects(
      compileCatalogue(config),
      /handbook.*render|render.*handbook|render failed/s,
    );
  }
});

test("legacy configuration is rejected even when explicitly undefined", async (context) => {
  const fixture = await createFixture(pageSource());
  context.after(() => removeFixture(fixture));
  for (const value of ["undefined", '{ pagesDir: "missing" }']) {
    await fs.promises.writeFile(
      fixture.configPath,
      `export default { entriesDir: "entries", mockupsDir: "mockups", legacy: ${value} };`,
    );
    await assert.rejects(loadConfig(fixture.root), /legacy.*definePage/s);
  }
});

test("unimported source helpers stay private without becoming catalogue entries", async (context) => {
  const fixture = await createFixture(pageSource());
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "unused.source.ts"),
    'throw new Error("must not load")',
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(result.manifest.entries.length, 1);
});

test("pages call the imported helper once and bypass the screen renderer", async (context) => {
  const fixture = await createFixture(pageSource("", "renderDocument"));
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "document.ts"),
    `let calls = 0; export function renderDocument() { if (++calls !== 1) throw new Error("repeated render"); return ${JSON.stringify(document)}; }`,
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { renderDocument } from "../document.ts";',
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.ts"),
    'export default () => { throw new Error("screen renderer must not render pages"); };',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", renderer: "renderer.ts", colorSchemes: ["light", "dark"] };',
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(result.outputs.size, 2);
  assert.equal(
    result.manifest.entries[0]?.sourcePath,
    "entries/fixture.mockup.tsx",
  );
  assert.ok(result.manifest.sourceFiles.includes("document.ts"));
});

test("pages share relationship and collision validation with screen entries", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const original = await fs.promises.readFile(fixture.entryPath, "utf8");
  const config = await loadConfig(fixture.root);
  const declaration = `definePage({ ${metadata}, route: "handbook.html", render: () => ${JSON.stringify(document)} })`;
  for (const [mutation, pattern] of [
    ['mockups[0].childIds.push("handbook", "handbook");', /duplicate-child/],
    ['mockups[0].childIds.push("missing");', /missing|unknown/],
    [
      'mockups.push(defineCollection({ id: "second", title: "Second", description: "Second", dependencies: [], relatedDocs: [], childIds: ["handbook"] })); mockups[0].childIds.push("handbook");',
      /multiple|parent/,
    ],
    ['mockups[3].steps[0].screenId = "handbook";', /screen/],
    ['mockups.at(-1).route = "screens/home.desktop.html";', /colli/],
    ['mockups.at(-1).route = "../outside.html";', /route|unsafe/],
    ['mockups.at(-1).route = "private.source.html";', /source/],
    ['mockups.at(-1).id = "home";', /duplicate/],
  ] as const) {
    await fs.promises.writeFile(
      fixture.entryPath,
      `${original}\nimport { definePage } from "@mokly/mokly"; mockups.push(${declaration}); ${mutation}`,
    );
    await assert.rejects(compileCatalogue(config), pattern, mutation);
  }
});

test("page logical links validate final page anchors and preserve native child controls", async (context) => {
  const source = `import { definePage, defineScreen, MockLink } from "@mokly/mokly"; import { renderToStaticMarkup } from "react-dom/server";
const meta = { title: "Example", description: "Example", dependencies: [], relatedDocs: [] };
export const mockups = [definePage({ ...meta, id: "page", route: "page.html", render: () => '<html><body><h1 id="section">Page</h1><a href="mock:screen#section">Screen</a></body></html>' }), defineScreen({ ...meta, id: "screen", route: "screen.html", useCaseIds: [], mobile: <main id="section"><MockLink to="page" fragment="section" asChild><button>Open page</button></MockLink></main>, desktop: <main id="section"><a href="mock:page#section">Page</a></main> })];`;
  const fixture = await createFixture(source);
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const result = await compileCatalogue(config);
  assert.match(
    textOutput(result.outputs, "page.html") ?? "",
    /screen.desktop.html#section/,
  );
  assert.match(
    textOutput(result.outputs, "screen.mobile.html") ?? "",
    /<a[^>]*href=".\/page.html#section"[^>]*>Open page<\/a>/,
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    source.replace('id="section">Page', 'id="different">Page'),
  );
  await assert.rejects(compileCatalogue(config), /fragment|anchor/);
});

test("complete documents retain the established post-screen render context", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "render-state.ts"),
    'let views = 0; export function screen() { views++; return "<html><body>Screen</body></html>"; } export function document() { if (views !== 4) throw new Error("document rendered before screen styles were collected"); return "<html><body>All screen styles are available</body></html>"; }',
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.ts"),
    'export { screen as default } from "./render-state.ts";',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", renderer: "renderer.ts" };',
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { definePage } from "@mokly/mokly"; import { document } from "../render-state.ts"; mockups.push(definePage({ id: "document", title: "Document", description: "Document", dependencies: [], relatedDocs: [], route: "aaa.html", render: document }));',
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.match(
    textOutput(result.outputs, "aaa.html") ?? "",
    /All screen styles are available/,
  );
});

test("page callbacks share ReviewIgnore serialization and final validation", async (context) => {
  const fixture = await createFixture(
    `import { definePage, ReviewIgnore } from "@mokly/mokly"; import { renderToStaticMarkup } from "react-dom/server"; export const mockups = [definePage({ ${metadata}, route: "page.html", render: () => renderToStaticMarkup(<html><body><ReviewIgnore id="chrome"><nav>Navigation</nav></ReviewIgnore><main>Document</main></body></html>) })];`,
  );
  context.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const html = textOutput(result.outputs, "page.html") ?? "";
  assert.doesNotMatch(html, /<template/);
  assert.match(html, /<!--.*chrome/);
});
