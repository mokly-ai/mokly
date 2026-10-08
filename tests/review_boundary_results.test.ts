import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { assertExportOwnership } from "../dist/export/ownership.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { parseStaticDelivery } from "../packages/viewer/dist/navigation/delivery.js";

import { entryAt } from "./helpers/catalogue_selection.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("equal package roots remain accepted by config and Build but fail export", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "package.json"),
    '{"name":"consumer"}',
  );
  const source = await fs.readFile(fixture.configPath, "utf8");
  await fs.writeFile(
    fixture.configPath,
    source.replace(
      'repoRoot: ".",',
      'repoRoot: ".", moduleResolution: { packageRoots: ["mockups"] },',
    ),
  );
  const config = await loadConfig(fixture.root);
  await compileCatalogue(config);
  await assert.rejects(
    capturePublicFiles(config, new Map(), []),
    /package root.*mockupsDir/,
  );
});

test("an unrelated mokly-generated source folder remains discoverable", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.entriesDir, "mokly-generated"));
  await fs.writeFile(
    path.join(fixture.entriesDir, "mokly-generated/extra.mockup.tsx"),
    'import { definePage } from "@mokly/mokly"; export const mockups = [definePage({ path: "extra", title: "Extra", description: "Extra", dependencies: [], relatedDocs: [], render: () => "<html><body>Extra</body></html>" })];',
  );
  const config = await loadConfig(fixture.root);
  assert.ok(
    config.entryModules?.some((file) =>
      file.endsWith("mokly-generated/extra.mockup.tsx"),
    ),
  );
  const compiled = await compileCatalogue(config);
  entryAt(compiled.manifest, "extra", "page");
});

test("static delivery classifies invalid and unsupported versions without throwing", () => {
  assert.deepEqual(parseStaticDelivery({}), { kind: "invalid" });
  assert.deepEqual(parseStaticDelivery({ schemaVersion: 3 }), {
    kind: "unsupported-version",
    version: 3,
  });
  const value = {
    schemaVersion: 5,
    deploymentId: "a".repeat(64),
    canonicalPath: "/",
    comparisonUrl: null,
  };
  assert.deepEqual(parseStaticDelivery(value), { kind: "valid", value });
});

test("every export ownership refusal identifies the destination without modifying it", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.mkdir(output);
  await fs.writeFile(path.join(output, "user.txt"), "keep");
  await assert.rejects(assertExportOwnership(output), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes(output), error.message);
    return true;
  });
  assert.equal(
    await fs.readFile(path.join(output, "user.txt"), "utf8"),
    "keep",
  );
});
