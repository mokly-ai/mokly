import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import type { JSONReport } from "@playwright/test/reporter";

import { parseManifest } from "../dist/registry/manifest.js";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  hydrationShapeKey,
  hydrationShapeSample,
} from "./helpers/hydration_shapes.js";

const execute = promisify(execFile);

test("every hydration shape has exactly one independently timed test", async () => {
  const manifest = parseManifest(
    JSON.parse(
      await fs.readFile(
        path.join(
          repositoryRoot,
          "examples/basic/generated/mokly-manifest.json",
        ),
        "utf8",
      ),
    ),
  );
  assert.ok(manifest.entries.length > 80);
  const sample = hydrationShapeSample(manifest.entries);
  const shapes = new Set(sample.map(({ shape }) => shape));
  assert.equal(shapes.size, sample.length);
  for (const entry of manifest.entries)
    assert.ok(
      shapes.has(hydrationShapeKey(entry)),
      `${entry.path} has no hydrated representative`,
    );
  const { stdout } = await execute(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "react_shell_hydration",
      "--list",
      "--reporter=json",
    ],
    { cwd: repositoryRoot, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout) as JSONReport;
  assert.deepEqual(report.errors, []);
  const prefix = "development React hydrates fixture route ";
  const observed = report.suites.flatMap((suite) =>
    suite.specs.flatMap((spec) =>
      spec.title.startsWith(prefix) ? [spec.title.slice(prefix.length)] : [],
    ),
  );
  assert.deepEqual(observed.sort(), sample.map(({ route }) => route).sort());
});
