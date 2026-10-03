import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { compileCatalogue } from "../dist/build/compile.js";
import { scanImportPrelude } from "../dist/build/styles/prelude.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const preludeCases = [
  '@import "./tokens.css"',
  '/* before */ @import "./tokens.css" /* EOF */',
  '@import "./\\74 okens.css";',
  '@import url("./tokens.css") layer(theme) supports(display:grid) screen;',
  "@import url(./tokens.css) layer(theme);",
  '@charset "UTF-8"; @layer theme; @import "./tokens.css";',
] as const;

test("the CSS prelude scanner agrees with esbuild edges, including EOF imports", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const source = path.join(fixture.entriesDir, "root.css");
  await fs.writeFile(
    path.join(fixture.entriesDir, "tokens.css"),
    ".token{color:red}",
  );
  for (const css of preludeCases) {
    await fs.writeFile(source, css);
    const scanned = scanImportPrelude(css).map((entry) => entry.specifier);
    const built = await build({
      absWorkingDir: fixture.root,
      bundle: true,
      entryPoints: [source],
      logLevel: "silent",
      metafile: true,
      outfile: path.join(fixture.root, "out.css"),
      write: false,
    });
    const edges =
      Object.entries(built.metafile.inputs)
        .find(([key]) => key.endsWith("entries/root.css"))?.[1]
        .imports.map((edge) => edge.path) ?? [];
    assert.equal(scanned.length, edges.length, css);
    assert.deepEqual(scanned, ["./tokens.css"], css);
  }
});

test("renderer @import at EOF keeps its closure out of the entry bundle", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./theme.css"; export default () => "<!doctype html><html><head></head><body>fixture</body></html>";',
  );
  await fs.writeFile(
    path.join(fixture.root, "theme.css"),
    '@import "./entries/token.css"',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "token.css"),
    ".token{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "entry.css"),
    ".entry{color:blue}",
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport "./token.css"; import "./entry.css";',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const renderer = compiled.outputs.get(
    "mokly-generated/styles/renderer.tsx.css",
  ) as string;
  const entry = compiled.outputs.get(
    "mokly-generated/styles/entries/fixture.mockup.tsx.css",
  ) as string;
  assert.match(renderer, /\.token/);
  assert.doesNotMatch(entry, /\.token/);
  assert.match(entry, /\.entry/);
});
