import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("PostCSS object plugins resolve import-only package exports from the module directory", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "configuration/postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const directory = path.join(fixture.root, "configuration");
  const packageDir = path.join(directory, "node_modules/@fixture/postcss");
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@fixture/postcss",
      type: "module",
      exports: { import: "./import.mjs", require: "./fail.cjs" },
    }),
  );
  await fs.writeFile(
    path.join(packageDir, "import.mjs"),
    `export default ({ color }) => ({ postcssPlugin: "fixture-package", Once(root) {
      root.walkRules(rule => rule.append({ prop: "border-color", value: color }));
    }});`,
  );
  await fs.writeFile(
    path.join(packageDir, "fail.cjs"),
    'throw new Error("require condition chosen")',
  );
  await fs.writeFile(
    path.join(directory, "postcss.config.mjs"),
    'export default { plugins: { "@fixture/postcss": { color: "purple" } } };',
  );
  const css = (await compileFixture(fixture)).outputs.get(entryStyle) as string;
  assert.match(css, /border-color: purple/);
});

test("config analysis does not evaluate PostCSS until graph load", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const marker = path.join(fixture.root, "evaluated.txt");
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `import fs from "node:fs";
     fs.writeFileSync(${JSON.stringify(marker)}, "evaluated");
     export default { plugins: [{ postcssPlugin: "noop", Once() {} }] };`,
  );
  const config = await loadConfig(fixture.root);
  await assert.rejects(fs.stat(marker), { code: "ENOENT" });
  assert.equal(config.postcss, path.join(fixture.root, "postcss.config.mjs"));
  await compileFixture(fixture);
  assert.equal(await fs.readFile(marker, "utf8"), "evaluated");
});

test("invalid PostCSS module shape, keys and plugin options retain exact diagnostics", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const file = path.join(fixture.root, "postcss.config.mjs");
  for (const [source, message] of [
    [
      'export default { plugins: [], parser: "css" }',
      "postcss configuration has unsupported key: parser; only plugins and map are supported",
    ],
    [
      "export default { map: true }",
      "postcss plugins must be an array of plugin instances or an object mapping package names to option objects",
    ],
    [
      "export default { plugins: [null] }",
      "postcss plugins[0] must be a PostCSS plugin instance",
    ],
    [
      'export default { plugins: { "missing-plugin": null } }',
      "postcss plugins[missing-plugin] must be a plain option object",
    ],
  ] as const) {
    await fs.writeFile(file, source);
    await assert.rejects(
      compileFixture(fixture),
      (error: unknown) =>
        error instanceof Error &&
        error.message === `[mokly/config-invalid] ${message}`,
    );
  }
});

test("plugin exceptions retain the plugin name and physical stylesheet", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "bad-plugin", Once() { throw new Error("deliberate failure") } }] };',
  );
  await assert.rejects(
    compileFixture(fixture),
    /PostCSS plugin bad-plugin failed for entries\/fixture\.css: deliberate failure; fix the plugin configuration or stylesheet/,
  );
});

test("missing PostCSS files and unresolvable package plugins give exact guidance", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    loadConfig(fixture.root),
    /postcss module must be an existing regular \.ts, \.mts, \.js, \.mjs or \.cjs file inside repoRoot: postcss\.config\.mjs/,
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: { "missing-postcss-plugin": {} } };',
  );
  await assert.rejects(
    compileFixture(fixture),
    /could not load PostCSS plugin missing-postcss-plugin from postcss\.config\.mjs: [\s\S]*; install and configure it in the consumer repository/,
  );
});
