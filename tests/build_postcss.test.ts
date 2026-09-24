import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("PostCSS transforms imported CSS before CSS Modules and inventories its dependencies", async (t) => {
  const fixture = await styleFixture(".card{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
    module: true,
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.entriesDir, "tokens.txt"), "private");
  await fs.writeFile(
    path.join(fixture.root, "postcss-helper.mjs"),
    `export const plugin = {
      postcssPlugin: "fixture-transform",
      Once(root, { result }) {
        root.walkRules(rule => { if (rule.selector === ".card") rule.append({ prop: "padding", value: "3px" }); });
        result.messages.push({ type: "dependency", plugin: "fixture-transform", file: new URL("./entries/tokens.txt", import.meta.url).pathname });
      }
    };`,
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'import { plugin } from "./postcss-helper.mjs"; export default { plugins: [plugin], map: { inline: true } };',
  );
  const config = await loadConfig(fixture.root);
  assert.equal(config.postcss, path.join(fixture.root, "postcss.config.mjs"));
  assert.ok(config.configSourceFiles?.includes("postcss-helper.mjs"));
  assert.equal(JSON.parse(JSON.stringify(config)).postcss, config.postcss);
  const compiled = await compileFixture(fixture);
  assert.match(compiled.outputs.get(entryStyle) as string, /padding: 3px/);
  assert.ok(compiled.manifest.sourceFiles.includes("entries/tokens.txt"));
  assert.deepEqual(
    (await loadConsumerGraph(config, false)).sourceFiles,
    compiled.manifest.sourceFiles,
  );
  assert.deepEqual(
    (await compileFixture(fixture)).outputs.get(entryStyle),
    compiled.outputs.get(entryStyle),
  );
});

test("PostCSS module import.meta values name the authored file", async (t) => {
  const fixture = await styleFixture(".source{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `import plugin from "./nested/plugin.mjs"; export default { plugins: [plugin] };`,
  );
  await fs.mkdir(path.join(fixture.root, "nested"));
  await fs.writeFile(
    path.join(fixture.root, "nested/plugin.mjs"),
    `export default { postcssPlugin: "meta", Once(root) {
      root.append({ selector: ".meta", nodes: [{ prop: "content", value: JSON.stringify([import.meta.url, import.meta.dirname, import.meta.filename]) }] });
    }};`,
  );
  const css = (await compileFixture(fixture)).outputs.get(entryStyle) as string;
  assert.match(css, /nested\/plugin\.mjs/);
  assert.doesNotMatch(css, /mokly-postcss-/);
});

test("a plugin transforms imported and nested CSS once each per compilation", async (t) => {
  const fixture = await styleFixture(
    '@import "./nested.css"; .entry{color:red}',
    {
      extraConfig: 'postcss: "postcss.config.mjs",',
    },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "nested.css"),
    ".nested{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `import fs from "node:fs";
    export default { plugins: [{ postcssPlugin: "once-per-input", Once(root, { result }) {
      fs.appendFileSync(new URL("./calls.txt", import.meta.url), result.opts.from + "\\n");
      root.walkRules(rule => rule.append({ prop: "padding", value: "7px" }));
    } }] };`,
  );
  const css = (await compileFixture(fixture)).outputs.get(entryStyle) as string;
  assert.match(css, /\.nested/);
  assert.match(css, /padding: 7px/);
  const calls = (
    await fs.readFile(path.join(fixture.root, "calls.txt"), "utf8")
  )
    .trim()
    .split("\n");
  assert.equal(calls.length, 2);
  assert.equal(new Set(calls).size, 2);
});

test("PostCSS rejects an escaping module path with catalogued guidance", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "../escaped.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    loadConfig(fixture.root),
    /\[mokly\/config-invalid\] postcss must name a config-relative module inside repoRoot: \.\.\/escaped\.mjs; choose an existing \.ts, \.mts, \.js, \.mjs or \.cjs file/,
  );
});

test("PostCSS outputs agree across two separate consumer processes", async (t) => {
  const fixture = await styleFixture(".button{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "colors", Once(root) { root.walkRules(rule => rule.append({ prop: "padding", value: "8px" })); } }] };',
  );
  const script = `import { compileCatalogue } from ${JSON.stringify(new URL("../dist/build/compile.js", import.meta.url).href)};
    import { loadConfig } from ${JSON.stringify(new URL("../dist/config/load.js", import.meta.url).href)};
    const compiled = await compileCatalogue(await loadConfig(${JSON.stringify(fixture.root)}));
    process.stdout.write(compiled.outputs.get(${JSON.stringify(entryStyle)}));`;
  const output = () =>
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: fixture.root,
      encoding: "utf8",
    });
  assert.equal(output(), output());
  assert.equal(
    output(),
    (await compileFixture(fixture)).outputs.get(entryStyle),
  );
});

test(
  "PostCSS configuration survives the real Serve IPC boundary",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await changedFixture(
      t,
      undefined,
      { extraConfig: 'postcss: "postcss.config.mjs",' },
      async (candidate) => {
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          ".ipc{color:red}",
        );
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
        await fs.writeFile(
          path.join(candidate.root, "postcss.config.mjs"),
          'export default { plugins: [{ postcssPlugin: "ipc", Once(root) { root.walkRules(rule => rule.append({ prop: "padding", value: "9px" })); } }] };',
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: false });
    fixture.beforeRemove(() => running.close());
    const response = await fetch(`${running.url}/static/${entryStyle}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /padding: 9px/);
  },
);
