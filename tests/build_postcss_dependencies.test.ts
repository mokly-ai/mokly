import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

async function pluginFixture(css: string, body: string, extraConfig = "") {
  const fixture = await styleFixture(css, {
    extraConfig: `postcss: "postcss.config.mjs", ${extraConfig}`,
  });
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "fixture-deps", Once(root, { result }) {
      ${body}
    } }] };`,
  );
  return fixture;
}

test("reported nested renderer CSS fails before inlining can duplicate it", async (t) => {
  const fixture = await pluginFixture(
    '@import "./mid.css"; .entry{color:green}',
    `if (result.opts.from.endsWith("fixture.css")) {
      result.messages.push({ type: "dependency", plugin: "fixture-deps", file: new URL("./entries/token.css", import.meta.url).pathname });
      root.append({ selector: ".inlined-token", nodes: [{ prop: "color", value: "red" }] });
    }`,
    'renderer: "renderer.tsx",',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./theme.css"; import { renderToStaticMarkup } from "react-dom/server"; export default ({node}) => `<!doctype html><html><head></head><body>${renderToStaticMarkup(node)}</body></html>`;',
  );
  await fs.writeFile(
    path.join(fixture.root, "theme.css"),
    '@import "./entries/token.css";',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "token.css"),
    ".token{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "mid.css"),
    '@import "./token.css"; .mid{color:orange}',
  );
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps reached renderer-owned CSS in entries\/fixture\.css: entries\/token\.css via entries\/mid\.css; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference/,
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "pass-through", Once() {} }] };',
  );
  const compiled = await compileFixture(fixture);
  const entry = compiled.outputs.get(entryStyle) as string;
  assert.match(entry, /\.mid/);
  assert.doesNotMatch(entry, /\.token/);
});

test("explicit generated output fails in both modes before public file validation", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dependency", plugin: "fixture-deps", file: new URL("./mockups/mokly-generated/styles/stray.css", import.meta.url).pathname });`,
  );
  t.after(() => removeFixture(fixture));
  for (const mode of ["committed", "derived"]) {
    if (mode === "derived")
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          '"committed"',
          '"derived"',
        ),
      );
    await assert.rejects(
      compileFixture(fixture),
      /PostCSS plugin fixture-deps scanned Mokly-generated output in entries\/fixture\.css: mockups\/mokly-generated\/styles\/stray\.css; exclude mockupsDir from the plugin's sources \(Tailwind: @source not "\.\.\/mockups"\)/,
    );
  }
});

test("plugin dependency on a public mockups file fails rather than hiding it", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dependency", plugin: "fixture-deps", file: new URL("./mockups/public.css", import.meta.url).pathname });`,
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "public.css"), ".public{}");
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps scanned a public mockups file in entries\/fixture\.css: mockups\/public\.css; exclude mockupsDir from the plugin's sources \(Tailwind: @source not "\.\.\/mockups"\)/,
  );
});

test("directory globs include matching authored files and exclude denied directories", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dir-dependency", plugin: "fixture-deps", dir: new URL("./sources", import.meta.url).pathname, glob: "**/*.txt" });`,
  );
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.root, "sources/node_modules"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixture.root, "sources/src"));
  await fs.writeFile(path.join(fixture.root, "sources/src/yes.txt"), "yes");
  await fs.writeFile(path.join(fixture.root, "sources/src/no.css"), "no");
  await fs.writeFile(
    path.join(fixture.root, "sources/node_modules/skip.txt"),
    "skip",
  );
  const config = await loadConfig(fixture.root);
  const graph = await loadConsumerGraph(config, false);
  assert.ok(graph.sourceFiles.includes("sources/src/yes.txt"));
  assert.ok(!graph.sourceFiles.includes("sources/src/no.css"));
  assert.ok(!graph.sourceFiles.includes("sources/node_modules/skip.txt"));
  assert.deepEqual(graph.postcssWatchDirectories, [
    { directory: path.join(fixture.root, "sources"), glob: "**/*.txt" },
  ]);
  assert.deepEqual(
    (await compileFixture(fixture)).manifest.sourceFiles,
    graph.sourceFiles,
  );
});

test("outside-root and node_modules dependency files are ignored before normalization", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dependency", plugin: "fixture-deps", file: "/tmp/not-in-repository.txt" });
     result.messages.push({ type: "dependency", plugin: "fixture-deps", file: new URL("./node_modules/not-installed.txt", import.meta.url).pathname });`,
  );
  t.after(() => removeFixture(fixture));
  const compiled = await compileFixture(fixture);
  assert.ok(
    !compiled.manifest.sourceFiles.some((file) =>
      file.includes("not-installed"),
    ),
  );
});

test("committed directory dependency rejects generated CSS before public files; derived skips generated", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dir-dependency", plugin: "fixture-deps", dir: new URL("./mockups", import.meta.url).pathname, glob: "**/*.css" });`,
  );
  t.after(() => removeFixture(fixture));
  const generated = path.join(
    fixture.mockupsDir,
    "mokly-generated/styles/stale.css",
  );
  await fs.mkdir(path.dirname(generated), { recursive: true });
  await fs.writeFile(generated, ".stale{}");
  await fs.writeFile(path.join(fixture.mockupsDir, "public.css"), ".public{}");
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps directory dependency scans Mokly-generated output in entries\/fixture\.css: mockups\/mokly-generated\/styles\/stale\.css; exclude mockupsDir by excluding the matching scan root \(Tailwind: @source not "\.\.\/mockups" or source\(none\) with explicit @source\)/,
  );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '"committed"',
      '"derived"',
    ),
  );
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps directory dependency scans a public mockups file in entries\/fixture\.css: mockups\/public\.css; exclude mockupsDir by excluding the matching scan root \(Tailwind: @source not "\.\.\/mockups" or source\(none\) with explicit @source\)/,
  );
});

test("parent directory globs still reach public mockups CSS unless explicitly scoped", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    `result.messages.push({ type: "dir-dependency", plugin: "fixture-deps", dir: import.meta.dirname, glob: "**/*.css" });`,
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "public.css"), ".public{}");
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '"committed"',
      '"derived"',
    ),
  );
  await assert.rejects(
    compileFixture(fixture),
    /directory dependency scans a public mockups file in entries\/fixture\.css: mockups\/public\.css; exclude mockupsDir by excluding the matching scan root \(Tailwind: @source not "\.\." or source\(none\) with explicit @source\)/,
  );
  await fs.mkdir(path.join(fixture.root, "authored"));
  await fs.writeFile(
    path.join(fixture.root, "authored/candidate.css"),
    ".candidate{}",
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "scoped", Once(root, {result}) { result.messages.push({ type: "dir-dependency", plugin: "scoped", dir: new URL("./authored", import.meta.url).pathname, glob: "*.css" }); } }] };',
  );
  const compiled = await compileFixture(fixture);
  assert.ok(compiled.manifest.sourceFiles.includes("authored/candidate.css"));
  assert.ok(!compiled.manifest.sourceFiles.includes("mockups/public.css"));
});

test("malformed or missing in-repository plugin dependencies fail with guidance", async (t) => {
  const fixture = await pluginFixture(
    ".x{color:red}",
    'result.messages.push({ type: "dependency", plugin: "fixture-deps" });',
  );
  t.after(() => removeFixture(fixture));
  const moduleFile = path.join(fixture.root, "postcss.config.mjs");
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps reported an invalid dependency for entries\/fixture\.css; report a file or directory path and optional glob/,
  );
  await fs.writeFile(
    moduleFile,
    'export default { plugins: [{ postcssPlugin: "fixture-deps", Once(root, { result }) { result.messages.push({ type: "dependency", plugin: "fixture-deps", file: "./absent.txt" }); } }] };',
  );
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps reported a missing dependency for entries\/fixture\.css: entries\/absent\.txt; make it a regular file or correct the plugin/,
  );
  await fs.writeFile(
    moduleFile,
    'export default { plugins: [{ postcssPlugin: "fixture-deps", Once(root, { result }) { result.messages.push({ type: "dir-dependency", plugin: "fixture-deps", dir: "./absent-dir" }); } }] };',
  );
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin fixture-deps reported a missing directory dependency for entries\/fixture\.css: entries\/absent-dir; create the directory or correct the plugin/,
  );
});
