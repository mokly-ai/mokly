import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import {
  registerFixturePage,
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("configured transforms rewrite document links using path-keyed logical routes", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="#">Menu</a><a href="./details.html">Details</a><span data-nav-href="mock:details">Open</span>',
    }),
  );
  context.after(() => removeFixture(fixture));
  const legacyDir = path.join(fixture.root, "legacy");
  await fs.promises.mkdir(path.join(legacyDir, "retired"), {
    recursive: true,
  });
  await fs.promises.writeFile(
    path.join(legacyDir, "notice.source.ts"),
    'export const source = () => "<!doctype html><html><body><a href=\\"mock:details\\">Details</a></body></html>";\n',
  );
  await fs.promises.writeFile(
    path.join(legacyDir, "ambiguous.source.ts"),
    'export const source = () => "<!doctype html><html><body><a href=\\"mock:details\\">Details</a></body></html>";\n',
  );
  await fs.promises.writeFile(
    path.join(legacyDir, "retired", "skip.source.ts"),
    'export const source = () => "<!doctype html><html><body>Skip</body></html>";\n',
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    `import path from "node:path";
import type { CompatibilityTransformInput } from "@mokly/mokly";
export default function transform(input: CompatibilityTransformInput): string {
  const logicalTarget = input.logicalRoutes["details"];
  const relative = logicalTarget
    ? path.posix.relative(path.posix.dirname(input.route), logicalTarget)
    : "missing";
  return input.content
    .replace('href="./details.html"', \`href="\${relative}"\`)
    .replace("<body", \`<body data-color-scheme="\${input.colorScheme}" data-logical-target="\${logicalTarget}" data-output-path="\${input.outputPath}" data-viewport="\${input.viewport}"\`);
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default {
  compatibility: { transformer: "compatibility.ts" },
  colorSchemes: ["light", "dark"],
  roots: [{ dir: "entries" }],
  mockupsDir: "mockups",
  repoRoot: "."
};\n`,
  );

  await registerFixturePage(
    fixture,
    "notice",
    "notice.html",
    "legacy/notice.source.ts",
  );
  await registerFixturePage(
    fixture,
    "ambiguous",
    "archive/ambiguous.mobile.dark.html",
    "legacy/ambiguous.source.ts",
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobile =
    textOutput(compilation.outputs, "home/index.mobile.html") ?? "";
  const mobileDark =
    textOutput(compilation.outputs, "home/index.mobile.dark.html") ?? "";
  const legacy = textOutput(compilation.outputs, "notice/index.html") ?? "";
  const ambiguousLegacy =
    textOutput(compilation.outputs, "ambiguous/index.html") ?? "";

  assert.match(mobile, /href="#"/);
  assert.match(mobile, /href="\.\.\/details\/index\.mobile\.html"/);
  assert.match(mobile, /data-nav-href="\.\.\/details\/index\.mobile\.html"/);
  assert.match(mobile, /data-output-path="mockups\/home\/index\.mobile\.html"/);
  assert.match(mobileDark, /data-color-scheme="dark"/);
  assert.match(
    mobileDark,
    /data-logical-target="details\/index\.mobile\.dark\.html"/,
  );
  assert.match(legacy, /href="\.\.\/details\/index\.desktop\.html"/);
  assert.match(ambiguousLegacy, /data-color-scheme="light"/);
  assert.match(ambiguousLegacy, /data-viewport="desktop"/);
  assert.match(
    ambiguousLegacy,
    /data-logical-target="details\/index\.desktop\.html"/,
  );
  assert.match(ambiguousLegacy, /href="\.\.\/details\/index\.desktop\.html"/);
  assert.equal(compilation.outputs.has("retired/skip.html"), false);
});

test("compatibility transforms reuse the logical route index for each view", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    `import type { CompatibilityTransformInput } from "@mokly/mokly";
const indexes = new Map<string, CompatibilityTransformInput["logicalRoutes"]>();
export default function transform(input: CompatibilityTransformInput): string {
  const key = \`${"${input.viewport}:${input.colorScheme}"}\`;
  const previous = indexes.get(key);
  indexes.set(key, previous ?? input.logicalRoutes);
  return input.content.replace(
    "<body",
    \`<body data-shared-logical-routes="${"${previous === undefined || previous === input.logicalRoutes}"}"\`,
  );
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { compatibility: { transformer: "compatibility.ts" }, colorSchemes: ["light", "dark"], roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  const compilation = await compileCatalogue(await loadConfig(fixture.root));

  for (const route of compilation.outputs.keys()) {
    if (!route.endsWith(".html")) continue;
    assert.match(
      textOutput(compilation.outputs, route)!,
      /data-shared-logical-routes="true"/,
      route,
    );
  }
});

test("configured compatibility transformers are typed complete-document functions", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { compatibility: { transformer: "compatibility.ts" }, roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    "export default 42;\n",
  );
  let config = await loadConfig(fixture.root);
  await assert.rejects(
    () => compileCatalogue(config),
    /compatibility transformer module must default-export a function/,
  );

  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    'export default () => "not a document";\n',
  );
  config = await loadConfig(fixture.root);
  await assert.rejects(
    () => compileCatalogue(config),
    /must return a complete HTML document/,
  );
});

test("compatibility output fails closed on unresolved navigation links", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    `import type { CompatibilityTransformInput } from "@mokly/mokly";
export default function transform(input: CompatibilityTransformInput): string {
  return input.content.replace("<body", '<body data-nav-href="mock:missing"');
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { compatibility: { transformer: "compatibility.ts" }, roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /unresolved id link mock:missing/,
  );
});

test("compatibility routes exclude generated files pending orphan removal", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "compatibility.ts"),
    `import type { CompatibilityTransformInput } from "@mokly/mokly";
export default function transform(input: CompatibilityTransformInput): string {
  if (input.availableRoutes.some((route) => route.includes("details."))) {
    throw new Error("pending orphan was exposed");
  }
  return input.content;
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  const initial = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(initial), initial);
  await fs.promises.writeFile(fixture.entryPath, oneScreenSource());
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { compatibility: { transformer: "compatibility.ts" }, roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  await assert.doesNotReject(async () =>
    compileCatalogue(await loadConfig(fixture.root)),
  );
});

function oneScreenSource(): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
export const mockups = [defineScreen({
  dependencies: [],
  description: "Home",
  desktop: <main>Home</main>,
  path: "home",
  mobile: <main>Home</main>,
  relatedDocs: [],
  title: "Home"
})];
`;
}
