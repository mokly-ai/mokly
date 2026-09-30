import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ComponentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { EsbuildInteractiveBundleCompiler } from "../dist/interactive/bundle.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("an edit before first Live preparation stays pinned until the next generation", async (t) => {
  const fixture = await pinnedFixture();
  t.after(() => removeFixture(fixture));
  const helper = path.join(fixture.entriesDir, "value.ts");
  const accepted = await prepare(fixture.root);

  await fs.writeFile(helper, 'export const marker = "next-generation";\n');
  const acceptedCode = await compile(accepted);
  assert.match(acceptedCode, /accepted-generation/);
  assert.doesNotMatch(acceptedCode, /next-generation/);

  const next = await prepare(fixture.root);
  const nextCode = await compile(next);
  assert.match(nextCode, /next-generation/);
  assert.doesNotMatch(nextCode, /accepted-generation/);
});

for (const mutation of ["delete", "syntax error"] as const) {
  test(`${mutation} before a first Live request leaves accepted bundle bytes unchanged`, async (t) => {
    const fixture = await pinnedFixture();
    t.after(() => removeFixture(fixture));
    const helper = path.join(fixture.entriesDir, "value.ts");
    const accepted = await prepare(fixture.root);

    if (mutation === "delete") await fs.rm(helper);
    else await fs.writeFile(helper, "export const marker = ;\n");
    const pinned = await compile(accepted);

    await fs.writeFile(
      helper,
      'export const marker = "accepted-generation";\n',
    );
    const comparison = await compile(await prepare(fixture.root));
    assert.equal(pinned, comparison);
  });
}

test("accepted entry modules are not rediscovered by the lazy browser build", async (t) => {
  const fixture = await pinnedFixture();
  t.after(() => removeFixture(fixture));
  const accepted = await prepare(fixture.root);
  await fs.writeFile(
    path.join(fixture.entriesDir, "late.mockup.tsx"),
    "export const mockups = [;\n",
  );

  assert.match(await compile(accepted), /accepted-generation/);
});

test("a deleted index module resolves from its accepted capture", async (t) => {
  const fixture = await createFixture(sourceWithImport("./feature"), {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const directory = path.join(fixture.entriesDir, "feature");
  await fs.mkdir(directory);
  await fs.writeFile(
    path.join(directory, "index.ts"),
    'export const marker = "captured-index";\n',
  );
  const accepted = await prepare(fixture.root);

  await fs.rm(directory, { recursive: true });
  assert.match(await compile(accepted), /captured-index/);
});

test("an aliased repository package reads its accepted captured bytes", async (t) => {
  const fixture = await createFixture(sourceWithImport("fixture-alias"), {
    extraConfig:
      'interactive: "serve", moduleResolution: { aliases: { "fixture-alias": "fixture-target" } },',
  });
  t.after(() => removeFixture(fixture));
  const packageRoot = path.join(fixture.root, "packages/fixture-target");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(path.join(fixture.root, "node_modules"), { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    '{"name":"fixture-target","type":"module","exports":"./index.ts"}\n',
  );
  const helper = path.join(packageRoot, "index.ts");
  await fs.writeFile(helper, 'export const marker = "captured-alias";\n');
  await fs.symlink(
    "../packages/fixture-target",
    path.join(fixture.root, "node_modules/fixture-target"),
  );
  const accepted = await prepare(fixture.root);

  await fs.writeFile(helper, 'export const marker = "changed-alias";\n');
  const code = await compile(accepted);
  assert.match(code, /captured-alias/);
  assert.doesNotMatch(code, /changed-alias/);
});

test("retargeting a repository symlink does not change its accepted bytes", async (t) => {
  const fixture = await createFixture(sourceWithImport("./current"), {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const first = path.join(fixture.entriesDir, "first.ts");
  const second = path.join(fixture.entriesDir, "second.ts");
  const current = path.join(fixture.entriesDir, "current.ts");
  await fs.writeFile(first, 'export const marker = "symlink-first";\n');
  await fs.writeFile(second, 'export const marker = "symlink-second";\n');
  await fs.symlink("first.ts", current);
  const accepted = await prepare(fixture.root);

  await fs.rm(current);
  await fs.symlink("second.ts", current);
  assert.match(await compile(accepted), /symlink-first/);
  assert.match(await compile(await prepare(fixture.root)), /symlink-second/);
});

test("installed-package modules remain filesystem-resolved", async (t) => {
  const fixture = await createFixture(sourceWithImport("fixture-package"), {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const packageRoot = path.join(fixture.root, "node_modules/fixture-package");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    '{"name":"fixture-package","type":"module","exports":"./index.js"}\n',
  );
  const modulePath = path.join(packageRoot, "index.js");
  await fs.writeFile(
    modulePath,
    'export const marker = "installed-accepted";\n',
  );
  const accepted = await prepare(fixture.root);

  await fs.writeFile(modulePath, 'export const marker = "installed-live";\n');
  const code = await compile(accepted);
  assert.match(code, /installed-live/);
  assert.doesNotMatch(code, /installed-accepted/);
});

test("a recorded package import ignores later repository metadata changes", async (t) => {
  const fixture = await createFixture(sourceWithImport("#fixture"), {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "package.json"),
    '{"type":"module","imports":{"#fixture":"./entries/first.ts"}}\n',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "first.ts"),
    'export const marker = "metadata-first";\n',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.ts"),
    'export const marker = "metadata-second";\n',
  );
  const accepted = await prepare(fixture.root);
  await fs.writeFile(
    path.join(fixture.root, "package.json"),
    '{"type":"module","imports":{"#fixture":"./entries/second.ts"}}\n',
  );

  const acceptedCode = await compile(accepted);
  assert.match(acceptedCode, /metadata-first/);
  assert.doesNotMatch(acceptedCode, /metadata-second/);

  const nextCode = await compile(await prepare(fixture.root));
  assert.match(nextCode, /metadata-second/);
  assert.doesNotMatch(nextCode, /metadata-first/);
});

async function pinnedFixture() {
  const fixture = await createFixture(sourceWithImport("./value"), {
    extraConfig: 'interactive: "serve",',
  });
  await fs.writeFile(
    path.join(fixture.entriesDir, "value.ts"),
    'export const marker = "accepted-generation";\n',
  );
  return fixture;
}

function sourceWithImport(specifier: string): string {
  return `import { marker } from ${JSON.stringify(specifier)};\n${validEntrySource({ body: "<span>{marker}</span>" })}`;
}

async function prepare(root: string): Promise<ComponentRuntime> {
  return prepareLiveRuntime(await loadConfig(root));
}

function compile(runtime: ComponentRuntime): Promise<string> {
  assert.ok(runtime.interactiveSources);
  return new EsbuildInteractiveBundleCompiler().compile({
    config: runtime.config,
    signal: new AbortController().signal,
    sources: runtime.interactiveSources,
  });
}
