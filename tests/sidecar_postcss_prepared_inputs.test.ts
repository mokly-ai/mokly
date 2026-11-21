import assert from "node:assert/strict";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { preparedSession } from "./helpers/prepared_session.js";
import { bundleParams, cssParams, startSidecar } from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

test("a prepared configuration failure belongs to CSS and leaves Bundle usable", async (context) => {
  const { params, write } = await editSource(context);
  await write(
    "postcss.mjs",
    "throw new Error('fixture configuration failed');",
  );
  const session = preparedSession(context);
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const bundled = await session.call({
    id: 1,
    method: "bundle",
    params: {
      ...params,
      preparation: { context: "attempt", postcss: "postcss.mjs" },
    },
  });
  assert.ok(bundled && typeof bundled === "object" && "generation" in bundled);
  await assert.rejects(
    session.call({
      id: 2,
      method: "processCss",
      params: cssParams({
        context: "attempt",
        sourceRoot: params.sourceRoot,
        moduleResolution: params.moduleResolution,
      }),
    }),
    {
      code: "bundle-failed",
      postcss: {
        kind: "load",
        module: "postcss.mjs",
        detail: "fixture configuration failed",
      },
    },
  );
});

test("fresh prepared contexts remove utilities and reload Tailwind configuration", async (context) => {
  const { params, write } = await editSource(context);
  params.moduleResolution = bundleParams().moduleResolution;
  await write(
    "postcss.mjs",
    "import tailwind from '@tailwindcss/postcss'; export default {plugins:[tailwind({base:import.meta.dirname,optimize:false})]};",
  );
  const text =
    "@import 'tailwindcss/utilities.css' source(none);\n@import './imported.css';\n@source './page.html';\n@config './tailwind.config.cjs';\n";
  await write("input.css", text);
  await write("imported.css", ".imported { --value: 0 }");
  await write(
    "tailwind.config.cjs",
    "module.exports={theme:{extend:{zIndex:{configured:'21'}}}};",
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [index, classes, order, imported, underline, italic] of [
    [0, "underline z-configured", 21, 0, true, false],
    [1, "underline italic z-configured", 21, 0, true, true],
    [2, "italic z-configured", 21, 0, false, true],
    [3, "italic z-configured", 22, 3, false, true],
  ] as const) {
    await write("page.html", `<p class="${classes}">Content</p>`);
    if (index === 3) {
      await write("imported.css", `.imported { --value: ${imported} }`);
      await write(
        "tailwind.config.cjs",
        `module.exports={theme:{extend:{zIndex:{configured:'${order}'}}}};`,
      );
    }
    const name = `attempt-${index}`;
    await sidecar.call("bundle", {
      ...params,
      evaluation: name,
      preparation: { context: name, postcss: "postcss.mjs" },
    });
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        context: name,
        sourceRoot: params.sourceRoot,
        moduleResolution: params.moduleResolution,
        text,
      }),
    );
    assert.equal(result.text.includes(".underline"), underline);
    assert.equal(result.text.includes(".italic"), italic);
    assert.ok(result.text.includes(`z-index: ${order}`), result.text);
    assert.ok(result.text.includes(`--value: ${imported}`), result.text);
    const fresh = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        context: `fresh-${index}`,
        sourceRoot: params.sourceRoot,
        moduleResolution: params.moduleResolution,
        text,
      }),
    );
    assert.equal(result.text, fresh.text);
  }
  await sidecar.call("shutdown");
});

test("fresh prepared contexts reload configuration plugins dependencies and imported files", async (context) => {
  const { params, write } = await editSource(context);
  params.moduleResolution = bundleParams().moduleResolution;
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [index, configured, plugin, dependency, imported] of [
    [0, 1, 2, 3, "first"],
    [1, 4, 5, 6, "second"],
  ] as const) {
    await write("imported.txt", imported);
    await write("dependency.mjs", `export default ${dependency};`);
    await write(
      "plugin.mjs",
      `import fs from 'node:fs';import dependency from './dependency.mjs';const imported=fs.readFileSync(new URL('./imported.txt',import.meta.url),'utf8');export default configured=>({postcssPlugin:'fresh-inputs',Once(root){for(const [prop,value] of Object.entries({configured,plugin:${plugin},dependency,imported}))root.append({selector:'.'+prop,nodes:[{prop:'value',value:String(value)}]});}});`,
    );
    await write(
      "postcss.mjs",
      `import plugin from './plugin.mjs';export default {plugins:[plugin(${configured})]};`,
    );
    const name = `attempt-${index}`;
    await sidecar.call("bundle", {
      ...params,
      evaluation: name,
      preparation: { context: name, postcss: "postcss.mjs" },
    });
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        context: name,
        sourceRoot: params.sourceRoot,
        moduleResolution: params.moduleResolution,
      }),
    );
    assert.equal(
      result.text,
      `.configured {\n    value: ${configured}\n}\n.plugin {\n    value: ${plugin}\n}\n.dependency {\n    value: ${dependency}\n}\n.imported {\n    value: ${imported}\n}`,
    );
    const fresh = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        context: `fresh-${index}`,
        sourceRoot: params.sourceRoot,
        moduleResolution: params.moduleResolution,
      }),
    );
    assert.equal(result.text, fresh.text);
  }
  await sidecar.call("shutdown");
});
