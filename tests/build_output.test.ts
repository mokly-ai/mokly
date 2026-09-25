import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
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

test("registry reports source-attributed collection forest violations", async (context) => {
  const fixture = await createFixture(`
import { defineCollection, defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], relatedDocs: [] };
export const mockups = [
  defineCollection({ ...metadata, childIds: ["shared", "shared", "missing"], description: "First parent", id: "a-parent", title: "First" }),
  defineCollection({ ...metadata, childIds: ["shared"], description: "Second parent", id: "z-parent", title: "Second" }),
  defineCollection({ ...metadata, childIds: ["cycle-b"], description: "Cycle A", id: "cycle-a", title: "Cycle A" }),
  defineCollection({ ...metadata, childIds: ["cycle-a"], description: "Cycle B", id: "cycle-b", title: "Cycle B" }),
  defineCollection({ ...metadata, childIds: ["self"], description: "Self cycle", id: "self", title: "Self" }),
  defineScreen({ ...metadata, description: "Shared screen", desktop: <main>Shared</main>, id: "shared", mobile: <main>Shared</main>, route: "shared.html", title: "Shared" })
];
`);
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);

  await assert.rejects(
    () => compileCatalogue(config),
    (error: Error) => {
      assert.match(
        error.message,
        /\[duplicate-child\] entries\/fixture\.mockup\.tsx \(a-parent\)/,
      );
      assert.match(
        error.message,
        /\[missing-child\].*unknown child id: missing/,
      );
      assert.match(error.message, /\[multiple-parents\].*\(z-parent\)/);
      assert.match(
        error.message,
        /collection cycle: cycle-a -> cycle-b -> cycle-a/,
      );
      assert.match(error.message, /collection cycle: self -> self/);
      return true;
    },
  );
});

test("screen colorSchemes must be a subset of config", async (context) => {
  const fixture = await createFixture(
    screenWithColorSchemes('["light", "dark"]'),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);

  await assert.rejects(
    () => compileCatalogue(config),
    /unsupported-color-scheme[\s\S]*screen declares "dark" but config colorSchemes is light-only/,
  );
  for (const colorSchemes of ["[]", '["dark"]', '["light", "light"]']) {
    await fs.promises.writeFile(
      fixture.entryPath,
      screenWithColorSchemes(colorSchemes),
    );
    await assert.rejects(
      () => compileCatalogue(config),
      /invalid-color-schemes[\s\S]*colorSchemes must be a non-empty subset of \["light", "dark"\] that includes "light"/,
    );
  }
});

test("missing declared dependencies and stylesheets are actionable", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource().replaceAll('"notes.md"', '"missing.md"'),
  );
  await assert.rejects(
    () => compileCatalogue(config),
    /path does not exist: missing.md/,
  );
  await fs.promises.writeFile(fixture.entryPath, validEntrySource());
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", stylesheets: [{ match: "**/*.html", stylesheets: ["missing.css"] }] };\n`,
  );
  const stylesheetConfig = await loadConfig(fixture.root);
  await assert.rejects(
    () => compileCatalogue(stylesheetConfig),
    /stylesheet does not exist/,
  );
});

test("scheme-specific stylesheets append after shared stylesheets", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: `colorSchemes: ["light", "dark"],
  stylesheets: [{ match: "**/*.html", stylesheets: ["shared.css"], darkStylesheets: ["dark.css"] }],`,
  });
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "shared.css"),
    "body { margin: 0; }\n",
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "dark.css"),
    "body { color: white; }\n",
  );
  const config = await loadConfig(fixture.root);

  const compilation = await compileCatalogue(config);
  const light =
    textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";
  const dark =
    textOutput(compilation.outputs, "screens/home.mobile.dark.html") ?? "";
  assert.deepEqual(stylesheetHrefs(light), ["../shared.css"]);
  assert.deepEqual(stylesheetHrefs(dark), ["../shared.css", "../dark.css"]);

  await fs.promises.rm(path.join(fixture.mockupsDir, "dark.css"));
  await assert.rejects(
    () => compileCatalogue(config),
    /stylesheet does not exist: dark\.css/,
  );
});

test("writer refuses to overwrite an unowned route", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const target = path.join(fixture.mockupsDir, "screens/home.mobile.html");
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, "user-authored\n");
  await assert.rejects(
    () => writeCompilation(compilation, config),
    /refusing to overwrite unowned/,
  );
  assert.equal(await fs.promises.readFile(target, "utf8"), "user-authored\n");
});

test("generic legacy TypeScript sources coexist through explicit config", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const pages = path.join(fixture.root, "legacy");
  await fs.promises.mkdir(pages);
  await fs.promises.writeFile(
    path.join(pages, "old.source.ts"),
    `export const source = () => "<!doctype html><html><body><main id=old>Legacy</main></body></html>";\n`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entriesDir: "entries",  mockupsDir: "mockups", repoRoot: "." };\n`,
  );
  await registerFixturePage(
    fixture,
    "old",
    "archive/old.html",
    "legacy/old.source.ts",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.ok(compilation.outputs.has("archive/old.html"));
  await writeCompilation(compilation, config);
  checkCompilation(await compileCatalogue(config), config);
});

test("consumer page composition replaces HTML comment components and owns lint policy", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "document.source.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
function Notice({label}) { return <aside id="notice">{label}</aside>; }
export function source() { return "<!doctype html>" + renderToStaticMarkup(<html><body><Notice label="Expanded" /></body></html>); }`,
  );
  await registerFixturePage(
    fixture,
    "notice",
    "old.html",
    "document.source.tsx",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.match(
    textOutput(compilation.outputs, "old.html") ?? "",
    /<aside id="notice">Expanded<\/aside>/,
  );
  assert.equal(
    (textOutput(compilation.outputs, "old.html") ?? "").match(/<aside/g)
      ?.length,
    1,
  );
});

function stylesheetHrefs(html: string): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(
    (match) => match[1] ?? "",
  );
}

function screenWithColorSchemes(colorSchemes: string): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
export const mockups = [defineScreen({
  colorSchemes: ${colorSchemes} as ("dark" | "light")[],
  dependencies: [],
  description: "Scheme screen",
  desktop: <main>Desktop</main>,
  id: "scheme-screen",
  mobile: <main>Mobile</main>,
  relatedDocs: [],
  route: "screens/scheme.html",
  title: "Scheme screen"
})];
`;
}
