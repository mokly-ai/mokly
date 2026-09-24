import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { exportResourcePolicy } from "../dist/export/resource_policy.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { writeExclusionFiles } from "./helpers/public_exclusions.js";

test("nested package payloads are excluded but ancestor package roots remain usable", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const nested = path.join(fixture.mockupsDir, "consumer-package");
  await fs.promises.mkdir(nested);
  await fs.promises.writeFile(
    path.join(nested, "package.json"),
    '{"name":"private-consumer"}',
  );
  await fs.promises.writeFile(
    path.join(nested, "internal.json"),
    '{"private":true}',
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "package.json"),
    '{"name":"consumer"}',
  );
  const configSource = await fs.promises.readFile(fixture.configPath, "utf8");
  await fs.promises.writeFile(
    fixture.configPath,
    configSource.replace(
      'repoRoot: ".",',
      'repoRoot: ".", moduleResolution: { packageRoots: [".", "mockups/consumer-package"] },',
    ),
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const files = await capturePublicFiles(
    config,
    compilation.outputs,
    compilation.manifest.assetClosure,
  );
  assert.ok(files.has(".generated/screens/home.mobile.html"));
  assert.ok(
    ![...files.keys()].some((name) => name.startsWith("consumer-package/")),
  );
});

test("a package root equal to mockupsDir fails explicitly instead of publishing a package", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "package.json"),
    '{"name":"private-consumer"}',
  );
  const config = {
    ...fixture.config,
    moduleResolution: {
      ...fixture.config.moduleResolution,
      packageRoots: [fixture.mockupsDir],
    },
  };
  await assert.rejects(
    capturePublicFiles(config, new Map(), ["package.json"]),
    /package root.*mockupsDir/,
  );
});

test("selected package resources cannot bypass the closure's private-source policy", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const nested = path.join(fixture.mockupsDir, "consumer-package");
  await fs.promises.mkdir(nested);
  await fs.promises.writeFile(
    path.join(nested, "package.json"),
    '{"name":"private-consumer"}',
  );
  await fs.promises.writeFile(
    path.join(nested, "theme.css"),
    "body { color: red; }",
  );
  const source = await fs.promises.readFile(fixture.configPath, "utf8");
  await fs.promises.writeFile(
    fixture.configPath,
    source.replace(
      'repoRoot: ".",',
      'repoRoot: ".", moduleResolution: { packageRoots: ["mockups/consumer-package"] },',
    ),
  );
  const config = await loadConfig(fixture.root);
  await assert.rejects(
    capturePublicFiles(config, new Map(), ["consumer-package/theme.css"]),
    /Private export resource/,
  );
  assert.equal(fs.existsSync(fixture.output), false);
});

test("export captures only referenced resources and generated documents", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await writeExclusionFiles(fixture.mockupsDir);
  const policy = exportResourcePolicy(fixture.config);
  assert.equal(policy("styles.css"), true);
  assert.equal(policy("internal/private.json"), true);
  const compilation = await compileCatalogue(fixture.config);
  const files = await capturePublicFiles(
    fixture.config,
    compilation.outputs,
    compilation.manifest.assetClosure,
  );
  assert.ok(files.has(".generated/screens/home.mobile.html"));
  assert.equal(files.has("internal/private.json"), false);
});

test("export refuses selected symlink resources", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await writeExclusionFiles(fixture.mockupsDir);
  await fs.promises.symlink(
    "README.md",
    path.join(fixture.mockupsDir, "alias.txt"),
  );
  await assert.rejects(
    capturePublicFiles(fixture.config, new Map(), ["alias.txt"]),
    /symlink/,
  );
});
