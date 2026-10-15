import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("base Tailwind automatic scans use the base source root and never head sources", async (context) => {
  const { head, base } = await sidecarSources(context);
  for (const [root, value] of [
    [base, 137],
    [head, 911],
  ] as const) {
    await fs.writeFile(
      path.join(root, "page.html"),
      `<p class="z-[${value}]">Side</p>`,
    );
    await fs.writeFile(
      path.join(root, "postcss.mjs"),
      `export default { plugins: { "@tailwindcss/postcss": {} } };`,
    );
    await fs.writeFile(
      path.join(root, "input.css"),
      '@import "tailwindcss/theme.css"; @tailwind utilities;',
    );
  }
  const sidecar = startSidecar(context, head);
  await sidecar.call("hello");
  const render = (root: string, context: string) =>
    sidecar.call<CssResult>(
      "processCss",
      cssParams({
        sourceRoot: root,
        repositoryRoots: [head],
        context,
        postcss: "postcss.mjs",
        sourcePath: "input.css",
        text: '@import "tailwindcss/theme.css"; @tailwind utilities;',
      }),
    );
  const before = await render(base, "base");
  assert.match(before.text, /z-index: 137/);
  assert.doesNotMatch(before.text, /z-index: 911/);
  const after = await render(head, "head");
  assert.match(after.text, /z-index: 911/);
  assert.doesNotMatch(after.text, /z-index: 137/);
  assert.ok(
    before.dependencies.some((dependency) => dependency.path.startsWith(base)),
  );
  assert.ok(
    !before.dependencies.some((dependency) => dependency.path.startsWith(head)),
  );
  await sidecar.call("shutdown");
});

test("base PostCSS relative file reads use the base process directory", async (context) => {
  const { head, base } = await sidecarSources(context);
  for (const [root, value] of [
    [base, "before"],
    [head, "after"],
  ] as const) {
    await fs.writeFile(path.join(root, "value.txt"), value);
    await fs.writeFile(
      path.join(root, "postcss.mjs"),
      `import fs from "node:fs"; export default {plugins:[{postcssPlugin:"cwd",Once(root){root.append({selector:".side",nodes:[{prop:"content",value:fs.readFileSync("value.txt","utf8")}]});}}]};`,
    );
  }
  const sidecar = startSidecar(context, head);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: base,
      repositoryRoots: [head],
      context: "base",
      postcss: "postcss.mjs",
      sourcePath: "input.css",
      text: ".a{}",
    }),
  );
  assert.match(result.text, /content: before/);
  assert.doesNotMatch(result.text, /content: after/);
  await sidecar.call("shutdown");
});
