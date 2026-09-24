import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("id-link rewriting changes only complete href attributes", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<p>Literal mock:missing-screen and mock:details</p><div data-route="mock:details">Metadata</div><a href="mock:details">Details</a>`,
    }),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);

  const compilation = await compileCatalogue(config);
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

  assert.match(mobile, /Literal mock:missing-screen and mock:details/);
  assert.match(mobile, /data-route="mock:details"/);
  assert.match(mobile, /href="\.\/details\.mobile\.html"/);
});

test("id-link rewriting uses parsed encoded href values", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.ts"),
    `export default function render() {
  return '<!doctype html><html><body><a href="mock&#58;details">Details</a></body></html>';
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entriesDir: "entries", mockupsDir: "mockups", renderer: "renderer.ts", repoRoot: "." };
`,
  );
  const config = await loadConfig(fixture.root);

  const compilation = await compileCatalogue(config);
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

  assert.match(mobile, /href="\.\/details\.mobile\.html"/);
  assert.doesNotMatch(mobile, /mock&#58;details/);
});

test("renderer output cannot duplicate reserved Browse metadata", async () => {
  for (const markup of [
    '<a data-mokly-link="details" DATA-MOKLY-LINK="home" href="mock:details">Details</a>',
    '<a data-mokly-target="_self" DATA-MOKLY-TARGET="_blank" href="mock:details">Details</a>',
  ]) {
    const fixture = await createFixture();
    try {
      await fs.promises.writeFile(
        path.join(fixture.root, "renderer.ts"),
        `export default function render() { return ${JSON.stringify(`<!doctype html><html><body>${markup}</body></html>`)}; }\n`,
      );
      await fs.promises.writeFile(
        fixture.configPath,
        'export default { entriesDir: "entries", mockupsDir: "mockups", renderer: "renderer.ts", repoRoot: "." };\n',
      );
      const config = await loadConfig(fixture.root);

      await assert.rejects(
        () => compileCatalogue(config),
        /duplicate reserved data-mokly-(?:link|target)/,
      );
    } finally {
      await removeFixture(fixture);
    }
  }
});

test("id-link rewriting resolves both navigation attributes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const attributes of [
    'href="mock:details" data-nav-href="mock:details"',
    'data-nav-href="mock:details" href="mock:details"',
  ]) {
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ body: `<a ${attributes}>Details</a>` }),
    );

    const compilation = await compileCatalogue(config);
    const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

    assert.doesNotMatch(mobile, /mock:details/);
    assert.match(mobile, /href="\.\/details\.mobile\.html"/);
    assert.match(mobile, /data-nav-href="\.\/details\.mobile\.html"/);
  }
});

test("link validation fails closed for non-portable targets", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<a href="details.mobile.html#absent">Broken anchor</a>`,
    }),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await assert.rejects(() => compileCatalogue(config), /missing target anchor/);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ body: `<a href="../../../outside.html">Escape</a>` }),
  );
  await assert.rejects(() => compileCatalogue(config), /escapes mockupsDir/);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ body: `<a href="missing.html">Missing</a>` }),
  );
  await assert.rejects(() => compileCatalogue(config), /missing target/);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({
      body: `<a href="./details.html">Logical route only</a>`,
    }),
  );
  await assert.rejects(() => compileCatalogue(config), /missing target/);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({
      body: `<a href="/screens/details.mobile.html">Root absolute</a>`,
    }),
  );
  await assert.rejects(() => compileCatalogue(config), /root-absolute link/);
});

test("link validation rejects generated targets pending orphan removal", async (context) => {
  const fixture = await createFixture(orphanLinkSource(true));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await fs.promises.writeFile(fixture.entryPath, orphanLinkSource(false));

  await assert.rejects(() => compileCatalogue(config), /missing target/);
});

test("catalogue routes reject URL and HTML attribute delimiters", async () => {
  for (const route of [
    'screens/details.mobile.html" onclick="alert.html',
    "screens/CON.html",
    "screens/details#alternate.html",
    "screens/details?alternate.html",
    "screens/details space.html",
  ]) {
    const fixture = await createFixture(routeSource(route));
    try {
      const config = await loadConfig(fixture.root);
      await assert.rejects(() => compileCatalogue(config), /invalid-route/);
    } finally {
      await removeFixture(fixture);
    }
  }
});

test("framework-emitted stylesheet URLs encode path segments", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "theme #1.css"),
    "body { color: black; }\n",
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default {
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  stylesheets: [{ match: "**/*.html", stylesheets: ["theme #1.css"] }]
};
`,
  );
  const config = await loadConfig(fixture.root);

  const compilation = await compileCatalogue(config);
  const mobile = compilation.outputs.get("screens/home.mobile.html") ?? "";

  assert.match(mobile, /href="\.\.\/theme%20%231\.css"/);
});

test("stylesheet rules match catalogue routes for every viewport", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "home.css"),
    "body { color: black; }\n",
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default {
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }]
};
`,
  );
  const config = await loadConfig(fixture.root);

  const compilation = await compileCatalogue(config);

  for (const viewport of ["mobile", "desktop"]) {
    const home = compilation.outputs.get(`screens/home.${viewport}.html`) ?? "";
    const details =
      compilation.outputs.get(`screens/details.${viewport}.html`) ?? "";
    assert.match(home, /href="\.\.\/home\.css"/);
    assert.doesNotMatch(details, /home\.css/);
  }
});

test("dark fragments link within dark and fall back to light-only", async (context) => {
  const fixture = await createFixture(darkLinkSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobileDark =
    compilation.outputs.get("screens/a.mobile.dark.html") ?? "";

  assert.match(mobileDark, /href="\.\/b\.mobile\.dark\.html"/);
  assert.match(mobileDark, /href="\.\/c\.mobile\.html"/);
});

function routeSource(route: string): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: ["notes.md"], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <a href="mock:unsafe-target">Target</a>, id: "home", mobile: <a href="mock:unsafe-target">Target</a>, route: "screens/home.html", title: "Home" }),
  defineScreen({ ...metadata, description: "Ordinary target", desktop: <main>Ordinary</main>, id: "ordinary-target", mobile: <main>Ordinary</main>, route: "screens/details.html", title: "Ordinary" }),
  defineScreen({ ...metadata, description: "Unsafe target", desktop: <main>Unsafe</main>, id: "unsafe-target", mobile: <main>Unsafe</main>, route: ${JSON.stringify(route)}, title: "Unsafe" })
];
`;
}

function orphanLinkSource(includeTarget: boolean): string {
  const target = includeTarget
    ? `defineScreen({ ...metadata, description: "Details", desktop: <main>Details</main>, id: "details", mobile: <main>Details</main>, route: "screens/details.html", title: "Details" })`
    : "";
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <a href="./details.desktop.html">Details</a>, id: "home", mobile: <a href="./details.mobile.html">Details</a>, route: "screens/home.html", title: "Home" }),
  ${target}
].filter(Boolean);
`;
}

function darkLinkSource(): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: [], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "A", desktop: <main><a href="mock:b">B</a><a href="mock:c">C</a></main>, id: "a", mobile: <main><a href="mock:b">B</a><a href="mock:c">C</a></main>, route: "screens/a.html", title: "A" }),
  defineScreen({ ...metadata, description: "B", desktop: <main>B</main>, id: "b", mobile: <main>B</main>, route: "screens/b.html", title: "B" }),
  defineScreen({ ...metadata, colorSchemes: ["light"], description: "C", desktop: <main>C</main>, id: "c", mobile: <main>C</main>, route: "screens/c.html", title: "C" })
];
`;
}
