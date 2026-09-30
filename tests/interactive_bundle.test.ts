import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ComponentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";
import {
  CachedInteractiveBundler,
  EsbuildInteractiveBundleCompiler,
  type InteractiveBundleCompiler,
} from "../dist/interactive/bundle.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test("the captured example graph keeps its Live bundle bytes unchanged", async () => {
  const config = await loadConfig(path.join(repositoryRoot, "examples/basic"));
  const runtime = await capturedRuntime(config);
  const code = await compileRuntime(runtime);
  const recaptured = await compileRuntime(await capturedRuntime(config));

  assert.equal(code, recaptured);
  assert.match(code, /createRoot/);
  assert.match(code, /data-mokly-interactive/);
  assert.match(code, /mountInteractiveDocument/);
});

test("browser bundle reports a typed Node-only importer diagnostic", async (t) => {
  const fixture = await createFixture(`
import fs from "node:fs";
import { defineScreen } from "@mokly/mokly";
const text = fs.readFileSync(new URL("../notes.md", import.meta.url), "utf8");
export const mockups = [defineScreen({
  dependencies: [], description: text, desktop: "Desktop", id: "node-only",
  mobile: "Mobile", relatedDocs: [], route: "screens/node-only.html", title: "Node only"
})];
`);
  t.after(() => removeFixture(fixture));
  const config = {
    ...(await loadConfig(fixture.root)),
    interactive: "serve" as const,
  };
  const graph = await loadConsumerGraph(config, {
    captureInteractiveSources: true,
    evaluate: false,
  });
  const sources = graph.interactiveSourceCapture?.seal();
  assert.ok(sources);

  await assert.rejects(
    new EsbuildInteractiveBundleCompiler().compile({
      config: { ...config, entryModules: graph.entrySources },
      signal: new AbortController().signal,
      sources,
    }),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "interactive-bundle");
      assert.match(error.message, /entries\/fixture\.mockup\.tsx/);
      assert.match(error.message, /node:fs/);
      return true;
    },
  );
});

test("browser bundle owns consumer peer-resolution diagnostics", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-interactive-peer-"),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.mkdir(path.join(root, "entries"));
  await fs.mkdir(path.join(root, "mockups"));
  await fs.writeFile(
    path.join(root, "entries", "peer.mockup.tsx"),
    `import { defineScreen } from "@mokly/mokly";
export const mockups = [defineScreen({
  dependencies: [], description: "Peer", desktop: <main>Peer</main>, id: "peer",
  mobile: <main>Peer</main>, relatedDocs: [], route: "peer.html", title: "Peer"
})];`,
  );
  const config = resolveConfig(
    { entriesDir: "entries", mockupsDir: "mockups", repoRoot: "." },
    path.join(root, "mokly.config.ts"),
  );
  const bytes = await fs.readFile(
    path.join(root, "entries", "peer.mockup.tsx"),
  );

  await assert.rejects(
    new EsbuildInteractiveBundleCompiler().compile({
      config: {
        ...config,
        entryModules: [path.join(root, "entries", "peer.mockup.tsx")],
      },
      signal: new AbortController().signal,
      sources: {
        files: [{ bytes, paths: ["entries/peer.mockup.tsx"] }],
        resolutions: [],
      },
    }),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "interactive-bundle");
      assert.match(error.message, /peer dependency react/);
      return true;
    },
  );
});

test("generation cache coalesces work, retains two and invalidates explicitly", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const sources = (await capturedRuntime(config)).interactiveSources;
  assert.ok(sources);
  let compilations = 0;
  const compiler: InteractiveBundleCompiler = {
    async compile() {
      compilations += 1;
      return `bundle-${compilations}`;
    },
  };
  const bundler = new CachedInteractiveBundler(compiler);

  const [first, duplicate] = await Promise.all([
    bundler.build({ config, generation: "a", sources }),
    bundler.build({ config, generation: "a", sources }),
  ]);
  assert.equal(compilations, 1);
  assert.strictEqual(first, duplicate);
  await bundler.build({ config, generation: "b", sources });
  assert.equal(
    (await bundler.build({ config, generation: "a", sources })).code,
    "bundle-1",
  );
  await bundler.build({ config, generation: "c", sources });
  assert.equal(
    (await bundler.build({ config, generation: "b", sources })).code,
    "bundle-2",
  );
  assert.equal(
    (await bundler.build({ config, generation: "a", sources })).code,
    "bundle-4",
  );
  bundler.invalidate("a");
  assert.equal(
    (await bundler.build({ config, generation: "a", sources })).code,
    "bundle-5",
  );
});

test("a rejected generation stays cached until explicit invalidation", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const sources = (await capturedRuntime(config)).interactiveSources;
  assert.ok(sources);
  let attempts = 0;
  const failure = new Error("browser bundle failed");
  const compiler: InteractiveBundleCompiler = {
    async compile() {
      attempts += 1;
      throw failure;
    },
  };
  const bundler = new CachedInteractiveBundler(compiler);
  const first = bundler.build({ config, generation: "failed", sources });
  const duplicate = bundler.build({ config, generation: "failed", sources });

  assert.strictEqual(first, duplicate);
  await assert.rejects(first, (error: unknown) => error === failure);
  await assert.rejects(
    bundler.build({ config, generation: "failed", sources }),
    (error: unknown) => error === failure,
  );
  assert.equal(attempts, 1);
  bundler.invalidate("failed");
  await assert.rejects(
    bundler.build({ config, generation: "failed", sources }),
    (error: unknown) => error === failure,
  );
  assert.equal(attempts, 2);
});

async function capturedRuntime(
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<ComponentRuntime> {
  return prepareLiveRuntime({ ...config, interactive: "serve" });
}

function compileRuntime(runtime: ComponentRuntime): Promise<string> {
  assert.ok(runtime.interactiveSources);
  return new EsbuildInteractiveBundleCompiler().compile({
    config: runtime.config,
    signal: new AbortController().signal,
    sources: runtime.interactiveSources,
  });
}
