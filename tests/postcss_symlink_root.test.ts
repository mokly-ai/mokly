import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("physical PostCSS messages map to a symlinked repository's logical inventory and watch roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias);
  context.after(() => fs.rm(alias));
  const config = await loadConfig(path.join(alias, "mokly.config.ts"));
  assert.equal(config.repoRoot, alias);
  const authored = path.join(fixture.root, "styles/tokens.css");
  await fs.mkdir(path.dirname(authored));
  await fs.writeFile(authored, ".tokens{color:red}");
  const source = path.join(fixture.root, "entries/fixture.css");
  const report = (file: string) => ({
    type: "dependency" as const,
    plugin: "fixture",
    source,
    file,
    malformed: false,
  });
  const collected = collectPostcssDependencies(
    config,
    [report(authored)],
    new Set(),
  );
  assert.ok(collected.sourceFiles.has(path.join(alias, "styles/tokens.css")));
  const directoryReport = collectPostcssDependencies(
    config,
    [
      {
        type: "dir-dependency",
        plugin: "fixture",
        source,
        directory: path.dirname(authored),
        glob: "*.css",
        malformed: false,
      },
    ],
    new Set(),
  );
  assert.deepEqual(directoryReport.watchDirectories, [
    {
      directory: path.join(alias, "styles"),
      glob: "*.css",
    },
  ]);
  const watched = { ...config, sourceFiles: ["styles/tokens.css"] };
  assert.equal(
    classifyWatchPath({ path: authored, kind: "change" }, watched),
    "rebuild",
  );

  const generated = path.join(
    fixture.mockupsDir,
    "mokly-generated/styles/stale.css",
  );
  await fs.mkdir(path.dirname(generated), { recursive: true });
  await fs.writeFile(generated, ".stale{}");
  assert.throws(
    () => collectPostcssDependencies(config, [report(generated)], new Set()),
    /PostCSS plugin fixture scanned Mokly-generated output in entries\/fixture.css: mockups\/mokly-generated\/styles\/stale.css/,
  );
  const publicCss = path.join(fixture.mockupsDir, "theme.css");
  await fs.writeFile(publicCss, ".public{}");
  assert.throws(
    () => collectPostcssDependencies(config, [report(publicCss)], new Set()),
    /PostCSS plugin fixture scanned a public mockups file in entries\/fixture.css: mockups\/theme.css/,
  );
});

test("symlinked roots retain nested renderer-owned import errors from physical PostCSS reports", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias);
  context.after(() => fs.rm(alias));
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      "review: {",
      'renderer: "renderer.tsx", postcss: "postcss.config.mjs", review: {',
    ),
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./theme.css"; export default () => "<!doctype html><html><head></head><body>fixture</body></html>";',
  );
  await fs.writeFile(
    path.join(fixture.root, "theme.css"),
    '@import "./entries/tokens.css";',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "tokens.css"),
    ".token{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "mid.css"),
    '@import "./tokens.css"; .mid{color:orange}',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.css"),
    '@import "./mid.css"; .entry{color:blue}',
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./fixture.css";');
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `import fs from "node:fs";
import path from "node:path";
export default { plugins: [{ postcssPlugin: "physical", Once(_root, { result }) {
  if (result.opts.from.endsWith("fixture.css")) result.messages.push({
    type: "dependency", plugin: "physical", file: fs.realpathSync(path.join(import.meta.dirname, "entries/tokens.css")),
  });
} }] };`,
  );
  for (const root of [fixture.root, alias]) {
    await assert.rejects(
      compileCatalogue(await loadConfig(path.join(root, "mokly.config.ts"))),
      /PostCSS plugin physical reached renderer-owned CSS in entries\/fixture.css: entries\/tokens.css via entries\/mid.css/,
    );
  }
});
