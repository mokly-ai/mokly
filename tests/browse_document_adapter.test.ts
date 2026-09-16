import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { adaptBrowseDocument } from "../dist/browse/document_adapter.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { generatedHeader } from "../dist/build/ownership.js";
import { loadConfig } from "../dist/config/load.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import {
  registerFixturePage,
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("Browse authenticates markers while preserving live navigation attributes", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: `<>
        <base target="InheritedFrame" />
        <a href="mock:details">Inherited</a>
        <a href="mock:details" target="">Own self</a>
        <a data-mokly-target="spoof" href="mock:details" target="_TOP">Top</a>
        <a href="mock:details" target="_blank">Blank</a>
        <a href="mock:details" target="Named.Frame:2">Named</a>
        <a href="mock:details" target=" invalid">Invalid</a>
        <a download href="mock:details" target="_top">Download</a>
        <a href="https://example.test/" target="_top">External</a>
        <a href="./details.mobile.html" target="_parent">Relative</a>
        <span id="local-target" />
        <a href="#local-target" target="NamedFrame">Hash</a>
        <map name="targets"><area href="mock:details" target="_parent" /></map>
        <svg><a href="mock:details" target="_blank"><text>SVG</text></a></svg>
        <span data-mokly-target="spoof" data-nav-href="mock:details">Metadata</span>
        <form target="_top"><button formTarget="_parent">Submit</button></form>
      </>`,
    }),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const route = "screens/home.mobile.html";
  const original = compilation.outputs.get(route) ?? "";
  const adapted = adaptBrowseDocument(
    original,
    route,
    createCatalogue(compilation.manifest),
  );

  assert.match(
    adapted,
    /href="\.\/details\.mobile\.html" data-mokly-link="details" data-mokly-target="InheritedFrame" data-mokly-inspector-link="0">Inherited/,
  );
  assert.match(
    adapted,
    /href="\.\/details\.mobile\.html" target="" data-mokly-link="details" data-mokly-inspector-link="1">Own self/,
  );
  assert.match(
    adapted,
    /target="_TOP"[^>]+data-mokly-target="_top" data-mokly-inspector-link="2">Top/,
  );
  assert.match(
    adapted,
    /target="_blank"[^>]+data-mokly-target="_blank" data-mokly-inspector-link="3">Blank/,
  );
  assert.match(
    adapted,
    /target="Named\.Frame:2"[^>]+data-mokly-target="Named\.Frame:2" data-mokly-inspector-link="4">Named/,
  );
  assert.match(adapted, /target=" invalid">Invalid/);
  assert.doesNotMatch(adapted, /target=" invalid"[^>]+data-mokly-link/);
  assert.match(
    adapted,
    /download="" href="\.\/details\.mobile\.html" target="_top">Download/,
  );
  assert.doesNotMatch(
    adapted,
    /target="_top"[^>]+data-mokly-link[^>]*>Download/,
  );
  assert.match(adapted, /data-nav-href="\.\/details\.mobile\.html">Metadata/);
  assert.doesNotMatch(adapted, /data-mokly-target="spoof"/);
  assert.match(
    adapted,
    /href="https:\/\/example\.test\/" target="_top">External/,
  );
  assert.match(
    adapted,
    /href="\.\/details\.mobile\.html" target="_parent">Relative/,
  );
  assert.match(adapted, /href="#local-target" target="NamedFrame">Hash/);
  assert.match(
    adapted,
    /<area href="\.\/details\.mobile\.html" target="_parent"[^>]+data-mokly-target="_parent"/,
  );
  assert.match(
    adapted,
    /<a href="\.\/details\.mobile\.html" target="_blank"[^>]+data-mokly-target="_blank" data-mokly-inspector-link="3"><text>SVG/,
  );
  assert.match(adapted, /<base target="InheritedFrame"/);
  assert.match(adapted, /<form target="_top"><button formTarget="_parent"/);
  assert.equal(original.includes("data-mokly-target"), true);
});

test("Browse strips reserved metadata from unowned HTML", () => {
  const catalogue = createCatalogue({
    entries: [],
    generatedBy: "mokly",
    sourceFiles: [],
    schemaVersion: 5,
  });
  const original = `<!doctype html><html><body><a data-mokly-link="home" DATA-MOKLY-LINK="details" data-mokly-target="_top" DATA-MOKLY-TARGET="_blank" href="./home.html">Home</a></body></html>`;
  const adapted = adaptBrowseDocument(original, "unowned.html", catalogue);

  assert.match(adapted, /href="\.\/home\.html"/);
  assert.doesNotMatch(adapted, /data-mokly-(?:link|target)/i);
});

test("Browse rejects duplicate reserved metadata in trusted HTML", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const catalogue = createCatalogue(compilation.manifest);
  const route = "screens/home.mobile.html";
  const original = compilation.outputs.get(route) ?? "";
  const mutations = [
    original.replace(
      'data-mokly-link="details"',
      'data-mokly-link="details" data-mokly-link="home"',
    ),
    original.replace(
      'data-mokly-link="details"',
      'data-mokly-link="details" data-mokly-target="_self" data-mokly-target="_blank"',
    ),
  ];

  for (const content of mutations) {
    assert.throws(
      () => adaptBrowseDocument(content, route, catalogue),
      /duplicate reserved data-mokly-(?:link|target)/,
    );
  }
});

test("Browse fails closed when trusted ownership or marker bytes diverge", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const catalogue = createCatalogue(compilation.manifest);
  const route = "screens/home.mobile.html";
  const original = compilation.outputs.get(route) ?? "";
  const mutations = [
    original.replace("Generated by mokly", "Generated elsewhere"),
    original.replace(
      generatedHeader("entries/fixture.mockup.tsx"),
      generatedHeader("entries/other.mockup.tsx"),
    ),
    original.replace('data-mokly-link="details"', 'data-mokly-link="missing"'),
    original.replace("./details.mobile.html", "./home.mobile.html"),
    original.replace("<head>", '<head><base href="https://example.test/">'),
  ];

  for (const content of mutations) {
    assert.throws(
      () => adaptBrowseDocument(content, route, catalogue),
      /trusted Browse document|marker|portable href|base href/,
    );
  }
});

test("Browse accepts CRLF generated ownership headers", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const route = "screens/home.mobile.html";
  const original = compilation.outputs.get(route) ?? "";
  const crlfHeader = original.replace("\n", "\r\n");

  const adapted = adaptBrowseDocument(
    crlfHeader,
    route,
    createCatalogue(compilation.manifest),
  );

  assert.match(adapted, /data-mokly-link="details"/);
});

test("Browse authenticates generated legacy links from their manifest owner", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const legacyDir = path.join(fixture.root, "legacy");
  await fs.promises.mkdir(legacyDir);
  await fs.promises.writeFile(
    path.join(legacyDir, "notice.source.ts"),
    'export const source = () => "<!doctype html><html><body><a href=\\"mock:details\\">Details</a></body></html>";\n',
  );
  await fs.promises.writeFile(
    path.join(legacyDir, "compact.mobile.source.ts"),
    'export const source = () => "<!doctype html><html><body><a href=\\"mock:details\\">Details</a></body></html>";\n',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entriesDir: "entries",  mockupsDir: "mockups", repoRoot: "." };\n',
  );
  await registerFixturePage(
    fixture,
    "notice",
    "notice.html",
    "legacy/notice.source.ts",
  );
  await registerFixturePage(
    fixture,
    "compact",
    "compact.mobile.html",
    "legacy/compact.mobile.source.ts",
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const original = compilation.outputs.get("notice.html") ?? "";
  const adapted = adaptBrowseDocument(
    original,
    "notice.html",
    createCatalogue(compilation.manifest),
  );

  assert.match(adapted, /href="\.\/screens\/details\.desktop\.html"/);
  assert.match(adapted, /data-mokly-link="details"/);

  const mobileRoute = "compact.mobile.html";
  const mobile = adaptBrowseDocument(
    compilation.outputs.get(mobileRoute) ?? "",
    mobileRoute,
    createCatalogue(compilation.manifest),
  );
  assert.match(mobile, /href="\.\/screens\/details\.desktop\.html"/);
  assert.match(mobile, /data-mokly-link="details"/);
});
