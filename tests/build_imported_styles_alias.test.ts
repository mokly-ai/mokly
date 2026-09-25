import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

test("symlinked repository root keeps identical CSS routes, links and inventory", async (context) => {
  const fixture = await styleFixture(".button{color:red}");
  const holder = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(holder));
  const alias = path.join(holder.root, "repository");
  await fs.symlink(fixture.root, alias);
  const direct = await compileCatalogue(await loadConfig(fixture.root));
  const indirect = await compileCatalogue(await loadConfig(alias));
  assert.equal(
    indirect.outputs.get(entryStyle),
    direct.outputs.get(entryStyle),
  );
  assert.match(
    indirect.outputs.get("screens/home.mobile.html") as string,
    /mokly-generated\/styles/,
  );
  assert.deepEqual(indirect.manifest.sourceFiles, direct.manifest.sourceFiles);
  assert.deepEqual(
    (await loadConsumerGraph(await loadConfig(alias), false)).sourceFiles,
    direct.manifest.sourceFiles,
  );
});

test("a symlinked public directory cannot be privatized by CSS url()", async (context) => {
  const fixture = await styleFixture(
    '.a{background:url("../mockups/logo.png")}',
  );
  context.after(() => removeFixture(fixture));
  const publicRoot = path.join(fixture.root, "site", "mockups");
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.rm(fixture.mockupsDir, { recursive: true });
  await fs.symlink(publicRoot, fixture.mockupsDir);
  await fs.writeFile(path.join(publicRoot, "logo.png"), Buffer.from([0, 255]));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /CSS asset is already public in entries\/fixture\.css: mockups\/logo\.png; move the imported asset outside mockupsDir or keep it as a separately linked public file/,
  );
});

test("a nested import cannot privatize authored public CSS", async (context) => {
  const fixture = await styleFixture(
    '@import "../mockups/shared.css"; .a{color:red}',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "shared.css"),
    ".shared{color:blue}",
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /CSS @import is already public in entries\/fixture\.css: mockups\/shared\.css; move the imported stylesheet outside mockupsDir or link it as public CSS/,
  );
});

test("transformer-only legacy CSS does not reject deliverable CSS syntax", async (context) => {
  const fixture = await styleFixture(
    '.clearfix{*zoom:1}.clearfix:after{content:"";display:table}',
    {
      extraConfig: 'compatibility: { transformer: "transform.ts" },',
    },
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'import "./entries/fixture.css"; export default ({ content }) => content;',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(compiled.outputs.has(entryStyle));
});

test("transformer-only legacy CSS is inventoried without strict parsing", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'compatibility: { transformer: "transform.ts" },',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "legacy.css"),
    ".clearfix{*zoom:1}",
  );
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'import "./legacy.css"; export default ({ content }) => content;',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(compiled.manifest.sourceFiles.includes("legacy.css"));
  assert.equal(compiled.outputs.has(entryStyle), false);
});
