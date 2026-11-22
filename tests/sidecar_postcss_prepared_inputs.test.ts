import assert from "node:assert/strict";
import test from "node:test";

import { PostcssWorkers } from "../packages/mokly/dist/sidecar/postcss.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { preparedSession } from "./helpers/prepared_session.js";
import {
  bundleParams,
  contextParams,
  cssParams,
  startSidecar,
} from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

test("a configuration failure belongs to CSS and leaves Bundle usable, with or without prepareContext", async (context) => {
  const { params, write } = await editSource(context);
  await write(
    "postcss.mjs",
    "throw new Error('fixture configuration failed');",
  );
  const failsToLoad = (
    session: ReturnType<typeof preparedSession>,
    id: number,
  ) =>
    assert.rejects(
      session.call({
        id,
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
  await failsToLoad(session, 2);
  const early = preparedSession(context);
  await early.call({ id: 0, method: "hello", params: {} });
  const preparation = { context: "attempt", postcss: "postcss.mjs" };
  const answered = await early.call({
    id: 1,
    method: "prepareContext",
    params: {
      ...preparation,
      sourceRoot: params.sourceRoot,
      repositoryRoots: params.repositoryRoots,
      moduleResolution: params.moduleResolution,
    },
  });
  assert.equal(answered, null);
  const prepared = await early.call({
    id: 2,
    method: "bundle",
    params: { ...params, preparation },
  });
  assert.ok(
    prepared && typeof prepared === "object" && "generation" in prepared,
  );
  await failsToLoad(early, 3);
});

test("prepareContext starts the only child before a restored Bundle", async (context) => {
  const { params, write } = await editSource(context);
  await write("postcss.mjs", "export default {plugins:[]};");
  await write("theme.css", ".theme{color:red}");
  const source = preparedSession(context);
  await source.call({ id: 0, method: "hello", params: {} });
  const full = (await source.call({
    id: 1,
    method: "bundle",
    params: { ...params, capture: "full" },
  })) as BundleResult;
  const preparations: Promise<void>[] = [];
  const prepare = PostcssWorkers.prototype.prepare;
  context.mock.method(
    PostcssWorkers.prototype,
    "prepare",
    function (this: PostcssWorkers, params: Parameters<typeof prepare>[0]) {
      const preparation = prepare.call(this, params);
      preparations.push(preparation);
      return preparation;
    },
  );
  let starts = 0;
  const session = preparedSession(
    context,
    () => Promise.reject(new Error("a restored reuse must not compile")),
    (operation) => {
      if (operation === "postcss-start") starts++;
    },
  );
  await session.call({ id: 0, method: "hello", params: {} });
  const preparation = { context: "startup", postcss: "postcss.mjs" };
  const reply = await session.call({
    id: 1,
    method: "prepareContext",
    params: {
      ...preparation,
      sourceRoot: params.sourceRoot,
      repositoryRoots: params.repositoryRoots,
      moduleResolution: params.moduleResolution,
    },
  });
  assert.equal(reply, null);
  assert.equal(preparations.length, 1);
  await preparations[0];
  assert.equal(starts, 1);
  await session.call({
    id: 2,
    method: "restoreGeneration",
    params: JSON.parse(
      JSON.stringify({
        generation: "restore:startup",
        params,
        compiled: full.compiled,
        modules: full.modules,
      }),
    ),
  });
  const bundled = await session.call({
    id: 3,
    method: "bundle",
    params: { ...params, capture: "full", preparation },
  });
  assert.deepEqual(bundled, {
    generation: full.generation,
    restoredGeneration: "restore:startup",
  });
  const css = (name: string) =>
    cssParams({
      context: name,
      sourceRoot: params.sourceRoot,
      moduleResolution: params.moduleResolution,
      sourcePath: "theme.css",
      text: ".theme{color:red}",
    });
  const prepared = await session.call({
    id: 4,
    method: "processCss",
    params: css("startup"),
  });
  assert.equal(starts, 1);
  const plain = await session.call({
    id: 5,
    method: "processCss",
    params: css("plain"),
  });
  assert.deepEqual(prepared, plain);
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
    const preparation = { context: name, postcss: "postcss.mjs" };
    await sidecar.call("prepareContext", contextParams(params, preparation));
    await sidecar.call("bundle", { ...params, evaluation: name, preparation });
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
    const preparation = { context: name, postcss: "postcss.mjs" };
    await sidecar.call("prepareContext", contextParams(params, preparation));
    await sidecar.call("bundle", { ...params, evaluation: name, preparation });
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
