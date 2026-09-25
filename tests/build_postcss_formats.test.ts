import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import postcss from "postcss";

import { loadConfig } from "../dist/config/load.js";
import { FileSystemPostcssConfigLoader } from "../dist/config/postcss_loader.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("PostCSS loads ESM, CommonJS and local CTS helpers with their native imports", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loader = new FileSystemPostcssConfigLoader();
  const base = await loadConfig(fixture.root);
  const pluginPackage = path.join(
    fixture.root,
    "node_modules",
    "fixture-plugin",
  );
  await fs.mkdir(pluginPackage, { recursive: true });
  await fs.writeFile(
    path.join(pluginPackage, "package.json"),
    JSON.stringify({
      exports: { import: "./import.mjs", require: "./require.cjs" },
    }),
  );
  await fs.writeFile(
    path.join(pluginPackage, "import.mjs"),
    'export default () => ({ postcssPlugin: "fixture-import", Once(root) { root.append({ selector: ".imported", nodes: [{ prop: "color", value: "red" }] }); } });',
  );
  await fs.writeFile(
    path.join(pluginPackage, "require.cjs"),
    'module.exports = () => ({ postcssPlugin: "fixture-require", Once(root) { root.append({ selector: ".required", nodes: [{ prop: "color", value: "blue" }] }); } });',
  );
  await fs.mkdir(path.join(fixture.root, "commonjs"));
  await fs.writeFile(
    path.join(fixture.root, "commonjs", "package.json"),
    '{"type":"commonjs"}',
  );
  await fs.writeFile(
    path.join(fixture.root, "helper.cts"),
    'const marker: string = "cts"; export const plugin = { postcssPlugin: marker, Once(root) { root.append({ selector: ".cts", nodes: [{ prop: "color", value: "green" }] }); } };',
  );
  const formats = [
    [
      "config.ts",
      'import plugin from "fixture-plugin"; export default { plugins: [plugin()] };',
      ".imported",
    ],
    [
      "config.mts",
      'import plugin from "fixture-plugin"; export default { plugins: [plugin()] };',
      ".imported",
    ],
    [
      "config.mjs",
      'import plugin from "fixture-plugin"; export default { plugins: [plugin()] };',
      ".imported",
    ],
    [
      "config.js",
      'import plugin from "fixture-plugin"; export default { plugins: [plugin()] };',
      ".imported",
    ],
    [
      "config.cjs",
      'const plugin = require("fixture-plugin"); const path = require("node:path"); module.exports = { plugins: [plugin()], map: { filename: path.join(__dirname, "x") } };',
      ".required",
    ],
    [
      "commonjs/config.js",
      'const plugin = require("fixture-plugin"); module.exports = { plugins: [plugin()], map: { filename: __filename } };',
      ".required",
    ],
    [
      "config-helper.mts",
      'import { plugin } from "./helper.cts"; export default { plugins: [plugin] };',
      ".cts",
    ],
  ] as const;
  for (const [name, code, expected] of formats) {
    const location = path.join(fixture.root, name);
    await fs.writeFile(location, code);
    const plugins = await loader.load({ ...base, postcss: location });
    const result = await postcss([...plugins]).process(".source{}", {
      from: undefined,
    });
    assert.match(result.css, new RegExp(expected.replace(".", "\\.")), name);
  }
});
