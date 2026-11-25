import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { build } from "esbuild";

import { currentDocumentPath } from "../packages/model/src/catalogue/delivery_paths.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";
import { bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { planNative } from "../packages/mokly/src/sidecar/native-plan.js";
import { PlanLookup } from "../packages/mokly/src/sidecar/resolution-plan.js";

import { consumer } from "./helpers/mokly_serve.js";
import { nativeRoot, write } from "./helpers/native_resolution.js";
import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";
import { command } from "./helpers/static_publication.js";

const folder = "packages/ui/.storybook";
const uiStory = "packages/ui/src/ui.stories.tsx";
const defaultStory = "specs/default.stories.tsx";
const story = `
export default { render: (_args, {globals}) => <output>{globals.place}</output> };
export const Primary = {};
`;
const preview = (place: string) =>
  `export default { initialGlobals: { place: ${JSON.stringify(place)} } };`;

for (const adapter of ["esbuild", "Vite"]) {
  test(`${adapter} renders each monorepo root with its own Storybook preview`, async (context) => {
    const config = "tools/catalogue.json";
    const root = await consumer(context, {
      [config]: JSON.stringify({
        repoRoot: "..",
        roots: [
          {
            dir: "../packages/ui/src",
            storybook: { config: "../packages/ui/.storybook" },
          },
          { dir: "../specs" },
        ],
        vite: adapter === "Vite",
      }),
      [uiStory]: story,
      [defaultStory]: story,
      [`${folder}/preview.js`]: preview("package preview"),
      [`${folder}/preview.tsx`]: preview("lower priority preview"),
      ".storybook/preview.ts": preview("repository preview"),
    });
    const built = await command(
      root,
      "build",
      ["--config", config, "--no-changes", "--strict"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(built.code, 0, built.stderr);
    for (const [entry, html] of [
      ["ui", "<output>package preview</output>"],
      ["default", "<output>repository preview</output>"],
    ] as const) {
      const document = await fs.readFile(
        path.join(
          root,
          "mokly-static",
          currentDocumentPath(`${entry}/index.mobile.html`),
        ),
        "utf8",
      );
      assert.ok(document.includes(html), entry);
    }
  });
}

async function bundleStories(
  context: TestContext,
  root: string,
  overrides: Parameters<typeof bundleParams>[0] = {},
) {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    entryFiles: [],
    storiesFiles: [defaultStory],
    renderer: null,
    sourceRoot: root,
    ...overrides,
  });
  const { generation } = await sidecar.call<BundleResult>("bundle", params);
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  return { sidecar, generation, params };
}

function renderStory(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
  file: string,
) {
  return sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: `${file}#Primary`,
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
}

for (const extension of ["mts", "cts", "mtsx", "ctsx"]) {
  test(`esbuild compiles preview.${extension} and applies its annotations`, async (context) => {
    const root = await nativeRoot(context);
    const jsx = extension.endsWith("x");
    const decorators = jsx
      ? ", decorators:[(Story) => <section data-extension={value}><Story /></section>]"
      : "";
    const content = `const value: string = ${JSON.stringify(extension)}; export default { initialGlobals: { place: value }${decorators} };`;
    await write(path.join(root, defaultStory), story);
    await write(path.join(root, `.storybook/preview.${extension}`), content);
    const { sidecar, generation } = await bundleStories(context, root);
    const { html } = await renderStory(sidecar, generation, defaultStory);
    const output = `<output>${extension}</output>`;
    assert.equal(
      html,
      jsx
        ? `<section data-extension="${extension}">${output}</section>`
        : output,
    );
  });
}

function tracedPreview(name: string, trace: string): string {
  return `
import { appendFileSync } from "node:fs";
${preview(name)}
export const beforeAll = () => {
  const trace = ${JSON.stringify(trace)};
  appendFileSync(trace, ${JSON.stringify(`${name} setup\n`)});
  return () => appendFileSync(trace, ${JSON.stringify(`${name} cleanup\n`)});
};
`;
}

test("Storybook setup cleans up and runs the next hook when stories alternate folders", async (context) => {
  const root = await nativeRoot(context);
  const trace = path.join(root, "trace.txt");
  await write(trace, "");
  await write(path.join(root, uiStory), story);
  await write(path.join(root, defaultStory), story);
  await write(
    path.join(root, ".storybook/preview.ts"),
    tracedPreview("root", trace),
  );
  await write(
    path.join(root, folder, "preview.ts"),
    tracedPreview("package", trace),
  );
  const { sidecar, generation, params } = await bundleStories(context, root, {
    storiesFiles: [uiStory, defaultStory],
    storybookFolders: { [uiStory]: folder },
  });
  for (const [file, html] of [
    [uiStory, "<output>package</output>"],
    [defaultStory, "<output>root</output>"],
    [uiStory, "<output>package</output>"],
  ] as const) {
    assert.equal((await renderStory(sidecar, generation, file)).html, html);
  }
  const reused = await sidecar.call<BundleResult>("bundle", params);
  assert.equal(reused.generation, generation);
  assert.equal(
    (await renderStory(sidecar, generation, uiStory)).html,
    "<output>package</output>",
  );
  const expected =
    "package setup\npackage cleanup\nroot setup\nroot cleanup\npackage setup\n";
  assert.equal(await fs.readFile(trace, "utf8"), expected);
  assert.equal(await sidecar.call("dispose", { generation }), null);
  assert.equal(await sidecar.call("dispose", { generation }), null);
  assert.equal(await fs.readFile(trace, "utf8"), expected);
});

test("a throwing Storybook setup fails its folder while another folder keeps rendering", async (context) => {
  const root = await nativeRoot(context);
  const trace = path.join(root, "trace.txt");
  await write(trace, "");
  await write(path.join(root, uiStory), story);
  await write(path.join(root, defaultStory), story);
  await write(
    path.join(root, ".storybook/preview.ts"),
    tracedPreview("root", trace),
  );
  await write(
    path.join(root, folder, "preview.ts"),
    `
let attempts = 0;
export const beforeAll = () => {
  throw new Error("package beforeAll failed on attempt " + ++attempts);
};
`,
  );
  const { sidecar, generation } = await bundleStories(context, root, {
    storiesFiles: [uiStory, defaultStory],
    storybookFolders: { [uiStory]: folder },
  });
  const failure = {
    code: "render-failed",
    message: /package beforeAll failed on attempt 1$/,
  };
  await assert.rejects(renderStory(sidecar, generation, uiStory), failure);
  assert.equal(await fs.readFile(trace, "utf8"), "");
  for (let render = 0; render < 2; render++) {
    assert.equal(
      (await renderStory(sidecar, generation, defaultStory)).html,
      "<output>root</output>",
    );
    await assert.rejects(renderStory(sidecar, generation, uiStory), failure);
  }
  const closed = once(sidecar.child, "close");
  assert.equal(await sidecar.call("shutdown"), null);
  assert.deepEqual(await closed, [0, null]);
  assert.equal(await fs.readFile(trace, "utf8"), "root setup\n");
});

test("native and planned resolution keep the preview's require-call edge", async (context) => {
  const root = await nativeRoot(context);
  const file = `${folder}/preview.cjs`;
  await write(path.join(root, uiStory), story);
  await write(
    path.join(root, file),
    'exports.default = { initialGlobals: { place: "CommonJS" } };',
  );
  const params = bundleParams({
    entryFiles: [],
    storiesFiles: [uiStory],
    renderer: null,
    sourceRoot: root,
    storybookFolders: { [uiStory]: folder },
  });
  const paths = await ModulePaths.create(params);
  paths.addConfigured(file);
  let observed: PlanLookup | undefined;
  const nativePlan: typeof build = async (options) => {
    const result = await build(options);
    assert.ok(result.metafile);
    const { plan } = await planNative(result.metafile, paths);
    const entry = new PlanLookup(plan);
    const previewPath = path.join(root, file);
    assert.ok(
      entry.get(path.join(root, "mokly-entry"), previewPath, "require-call"),
    );
    assert.equal(
      entry.get(
        path.join(root, "mokly-entry"),
        previewPath,
        "import-statement",
      ),
      undefined,
    );
    observed = entry;
    return result;
  };
  const result = await bundleWith(params, nativePlan, unmeasured, {
    mode: "native",
  });
  assert.ok("generation" in result || result.plan);
  assert.ok(observed);
  const full = await bundleWith(params, build, unmeasured, {
    mode: "planned",
    plan: observed,
  });
  assert.ok(full.result.modules.some((module) => module.path === file));
});

test("Vite reports its bundle error for the first preview even when a later preview compiles", async (context) => {
  const root = await consumer(context, {
    [defaultStory]: story,
    ".storybook/preview.mtsx":
      'const value: string = "unsupported"; export default { initialGlobals: { place: value } };',
    ".storybook/preview.cts": "export default {};",
  });
  await assert.rejects(bundleStories(context, root, { vite: true }), {
    code: "bundle-failed",
    message: /preview\.mtsx: vite: Parse failure/,
  });
});
