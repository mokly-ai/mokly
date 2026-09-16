import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { exportResourcePolicy } from "../dist/export/resource_policy.js";
import { exportCatalogue } from "../dist/export/run.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import {
  excludedNames,
  permittedNames,
  writeExclusionFiles,
} from "./helpers/public_exclusions.js";

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
  const files = await capturePublicFiles(config);
  assert.ok(files.has("screens/home.mobile.html"));
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
  await assert.rejects(capturePublicFiles(config), /package root.*mockupsDir/);
});

test("baseline package resources cannot bypass current public-file exclusions", async (context) => {
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
  const baseline = path.join(fixture.mockupsDir, "screens/home.mobile.html");
  await fs.promises.appendFile(
    baseline,
    '<link rel="stylesheet" href="../consumer-package/theme.css">',
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
  await fixture.git("add", ".");
  await fixture.git("commit", "-qm", "test: baseline package resource");
  await assert.rejects(
    exportCatalogue(config, { outDir: "site", base: "HEAD" }),
    /private export resource/,
  );
  assert.equal(fs.existsSync(fixture.output), false);
});

test("export resource policy excludes defaults and consumer globs while retaining public names", async (t) => {
  const fixture = await createExportFixture(undefined, {
    extraConfig: 'publicExclude: ["INTERNAL/**"],',
  });
  t.after(() => fixture.close());
  await writeExclusionFiles(fixture.mockupsDir);
  const policy = exportResourcePolicy(fixture.config);
  for (const name of excludedNames) assert.equal(policy(name), false, name);
  for (const name of permittedNames) assert.equal(policy(name), true, name);
});

test("export omits public-looking aliases of excluded resources", async (t) => {
  const fixture = await createExportFixture(undefined, {
    extraConfig: 'publicExclude: ["internal/**"],',
  });
  t.after(() => fixture.close());
  await writeExclusionFiles(fixture.mockupsDir);
  await fs.promises.symlink(
    "README.md",
    path.join(fixture.mockupsDir, "alias.txt"),
  );
  const policy = exportResourcePolicy(fixture.config);
  assert.equal(policy("alias.txt"), false);
  assert.equal(
    (await capturePublicFiles(fixture.config)).has("alias.txt"),
    false,
  );
});
