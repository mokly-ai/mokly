import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ComponentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { EsbuildInteractiveBundleCompiler } from "../dist/interactive/bundle.js";
import {
  InteractiveBundleError,
  InteractiveBundleReason,
} from "../dist/interactive/errors.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const repositoryRequests = [
  {
    config:
      'interactive: "serve", moduleResolution: { aliases: { "fixture-alias": "fixture-target" } },',
    label: "configured alias",
    specifier: "fixture-alias",
  },
  {
    config: 'interactive: "serve",',
    label: "repository package",
    specifier: "fixture-target",
  },
] as const;

for (const request of repositoryRequests) {
  test(`a deleted ${request.label} target stays pinned and a later generation sees its replacement`, async (t) => {
    const fixture = await packageFixture(request.specifier, request.config);
    t.after(() => removeFixture(fixture));
    const modulePath = path.join(
      fixture.root,
      "packages/fixture-target/index.ts",
    );
    const accepted = await prepare(fixture.root);

    assertRecordedRequest(accepted, request.specifier, "index.ts");
    await fs.rm(modulePath);
    assert.match(await compile(accepted), /accepted-package/);

    await fs.writeFile(modulePath, packageSource("replacement-package"));
    const next = await prepare(fixture.root);
    const nextCode = await compile(next);
    assert.match(nextCode, /replacement-package/);
    assert.doesNotMatch(nextCode, /accepted-package/);
  });

  test(`a renamed ${request.label} target stays pinned and a later generation sees the rename`, async (t) => {
    const fixture = await packageFixture(request.specifier, request.config);
    t.after(() => removeFixture(fixture));
    const packageRoot = path.join(fixture.root, "packages/fixture-target");
    const original = path.join(packageRoot, "index.ts");
    const renamed = path.join(packageRoot, "renamed.ts");
    const accepted = await prepare(fixture.root);

    await fs.rename(original, renamed);
    await fs.writeFile(renamed, packageSource("renamed-package"));
    await writePackageManifest(packageRoot, "renamed.ts");
    assert.match(await compile(accepted), /accepted-package/);

    const next = await prepare(fixture.root);
    const nextCode = await compile(next);
    assert.match(nextCode, /renamed-package/);
    assert.doesNotMatch(nextCode, /accepted-package/);
    assertRecordedRequest(next, request.specifier, "renamed.ts");
  });
}

test("recorded repository packages keep the accepted Node condition in Live", async (t) => {
  const fixture = await createFixture(sourceWithImport("fixture-target"), {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const packageRoot = await createLinkedPackage(fixture);
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      exports: {
        ".": {
          browser: "./browser.ts",
          node: "./node.ts",
        },
      },
      name: "fixture-target",
      type: "module",
    }),
  );
  await fs.writeFile(
    path.join(packageRoot, "node.ts"),
    packageSource("node-condition-marker"),
  );
  await fs.writeFile(
    path.join(packageRoot, "browser.ts"),
    packageSource("browser-condition-marker"),
  );

  const accepted = await prepare(fixture.root);
  assertRecordedRequest(accepted, "fixture-target", "node.ts");
  const code = await compile(accepted);
  assert.match(code, /node-condition-marker/);
  assert.doesNotMatch(code, /browser-condition-marker/);
});

test("an unrecorded bare repository request fails with its typed diagnostic", async (t) => {
  const fixture = await packageFixture(
    "fixture-target",
    'interactive: "serve",',
  );
  t.after(() => removeFixture(fixture));
  const accepted = await prepare(fixture.root);
  assert.ok(accepted.interactiveSources);
  const sources = {
    ...accepted.interactiveSources,
    resolutions: accepted.interactiveSources.resolutions.filter(
      (resolution) => resolution.specifier !== "fixture-target",
    ),
  };

  await assert.rejects(
    compile({ ...accepted, interactiveSources: sources }),
    (error: unknown) => {
      assert.ok(error instanceof InteractiveBundleError);
      assert.equal(error.reason, InteractiveBundleReason.SourceNotCaptured);
      assert.equal(error.module, "node_modules/fixture-target/index.ts");
      assert.equal(error.importer, "entries/fixture.mockup.tsx");
      return true;
    },
  );
});

async function packageFixture(
  specifier: string,
  config: string,
): Promise<TestFixture> {
  const fixture = await createFixture(sourceWithImport(specifier), {
    extraConfig: config,
  });
  const packageRoot = await createLinkedPackage(fixture);
  await writePackageManifest(packageRoot, "index.ts");
  await fs.writeFile(
    path.join(packageRoot, "index.ts"),
    packageSource("accepted-package"),
  );
  return fixture;
}

async function createLinkedPackage(fixture: TestFixture): Promise<string> {
  const packageRoot = path.join(fixture.root, "packages/fixture-target");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(path.join(fixture.root, "node_modules"), { recursive: true });
  await fs.symlink(
    "../packages/fixture-target",
    path.join(fixture.root, "node_modules/fixture-target"),
  );
  return packageRoot;
}

function writePackageManifest(root: string, target: string): Promise<void> {
  return fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      exports: `./${target}`,
      name: "fixture-target",
      type: "module",
    }),
  );
}

function packageSource(marker: string): string {
  return `export const marker = ${JSON.stringify(marker)};\n`;
}

function sourceWithImport(specifier: string): string {
  return `import { marker } from ${JSON.stringify(specifier)};\n${validEntrySource({ body: "<span>{marker}</span>" })}`;
}

function assertRecordedRequest(
  runtime: ComponentRuntime,
  specifier: string,
  target: string,
): void {
  assert.ok(runtime.interactiveSources);
  const resolution = runtime.interactiveSources.resolutions.find(
    (candidate) => candidate.specifier === specifier,
  );
  assert.deepEqual(resolution, {
    attributes: [],
    importer: {
      path: "entries/fixture.mockup.tsx",
      type: "repository",
    },
    kind: "import-statement",
    specifier,
    target: `node_modules/fixture-target/${target}`,
  });
  assert.ok(
    runtime.interactiveSources.files.some(
      (file) =>
        file.paths.includes(`node_modules/fixture-target/${target}`) &&
        file.paths.includes(`packages/fixture-target/${target}`),
    ),
  );
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
