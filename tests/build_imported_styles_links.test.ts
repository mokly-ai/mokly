import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

const hrefs = (html: string): string[] =>
  [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(
    (match) => match[1]!,
  );

test("renderer and exporting entry links follow configured order across nested and dark views", async (t) => {
  const fixture = await createFixture(
    validEntrySource().replaceAll(
      "screens/home.html",
      "screens/nested/home.html",
    ),
    {
      extraConfig:
        'renderer: "renderer.tsx", colorSchemes: ["light", "dark"], stylesheets: [{ match: "**", stylesheets: ["shared.css"], darkStylesheets: ["night.css"] }],',
    },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.css"),
    ".renderer{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "entry.css"),
    ".entry{color:blue}",
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "shared.css"), ".shared{}");
  await fs.writeFile(path.join(fixture.mockupsDir, "night.css"), ".night{}");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./renderer.css"; import { renderToStaticMarkup } from "react-dom/server"; export default ({node,stylesheets}) => `<!doctype html><html><head>${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body>${renderToStaticMarkup(node)}</body></html>`;',
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./entry.css";');
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const route = "screens/nested/home.mobile.dark.html";
  assert.deepEqual(hrefs(compiled.outputs.get(route) as string), [
    "../../shared.css",
    "../../night.css",
    "../../mokly-generated/styles/renderer.tsx.css",
    "../../mokly-generated/styles/entries/fixture.mockup.tsx.css",
  ]);
  assert.deepEqual(
    hrefs(compiled.outputs.get("screens/nested/home.desktop.html") as string),
    [
      "../../shared.css",
      "../../mokly-generated/styles/renderer.tsx.css",
      "../../mokly-generated/styles/entries/fixture.mockup.tsx.css",
    ],
  );
});

test("a re-exported helper screen links its exporting entry's stylesheet", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "helper.tsx"),
    `import "./helper.css"; ${validEntrySource()}`,
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "helper.css"),
    ".helper{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "one.css"),
    ".one{color:blue}",
  );
  await fs.writeFile(
    fixture.entryPath,
    'export { mockups } from "./helper"; import "./one.css";',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const html = compiled.outputs.get("screens/home.mobile.html") as string;
  assert.match(html, /source-base64=/);
  assert.deepEqual(hrefs(html), [
    "../mokly-generated/styles/entries/fixture.mockup.tsx.css",
  ]);
  assert.equal(
    compiled.manifest.entries.find((entry) => entry.id === "home")?.sourcePath,
    "entries/helper.tsx",
  );
  assert.ok(!JSON.stringify(compiled.manifest).includes("entryRoot"));
});

test("a helper-registered component links the entry stylesheet in saved variants", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "helper.tsx"),
    componentEntrySource(),
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "one.css"),
    ".one{color:blue}",
  );
  await fs.writeFile(
    fixture.entryPath,
    'export { mockups } from "./helper"; import "./one.css";',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const routes = [...compiled.outputs.keys()].filter(
    (route) =>
      route.startsWith("components/action.") && route.endsWith(".html"),
  );
  assert.ok(routes.length >= 4, routes.join(", "));
  for (const route of routes)
    assert.deepEqual(hrefs(compiled.outputs.get(route) as string), [
      path.posix.relative(
        path.posix.dirname(route),
        "mokly-generated/styles/entries/fixture.mockup.tsx.css",
      ),
    ]);
});

test("each exporting entry links its own CSS while a page receives no automatic link", async (t) => {
  const fixture = await styleFixture(".first{color:red}");
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.css"),
    ".second{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.mockup.tsx"),
    `import "./second.css"; import React from "react"; import { defineScreen, definePage } from "@mokly/mokly";
    export const mockups = [defineScreen({ id: "second", title: "Second", description: "Second screen", route: "screens/second.html", dependencies: [], relatedDocs: [], mobile: <p>Second</p>, desktop: <p>Second</p>, useCaseIds: [] }), definePage({ id: "paper", title: "Paper", description: "A page", route: "paper.html", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><head></head><body>Paper</body></html>" })];`,
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.deepEqual(
    hrefs(compiled.outputs.get("screens/home.mobile.html") as string),
    ["../mokly-generated/styles/entries/fixture.mockup.tsx.css"],
  );
  assert.deepEqual(
    hrefs(compiled.outputs.get("screens/second.mobile.html") as string),
    ["../mokly-generated/styles/entries/second.mockup.tsx.css"],
  );
  assert.ok(
    compiled.outputs.has(
      "mokly-generated/styles/entries/second.mockup.tsx.css",
    ),
  );
  assert.deepEqual(hrefs(compiled.outputs.get("paper.html") as string), []);
});
