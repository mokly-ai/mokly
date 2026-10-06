import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import type { JSONReport } from "@playwright/test/reporter";

import { parseManifest } from "../dist/registry/manifest.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

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
  assert.deepEqual(
    observed.sort(),
    hydrationShapeSample(manifest.entries)
      .map(({ route }) => route)
      .sort(),
  );
  const shapeByRoute = new Map(
    manifest.entries.map((entry) => [
      entryRoute(entry.path),
      hydrationShapeKey(entry),
    ]),
  );
  const observedShapes = observed.map((route) => shapeByRoute.get(route));
  assert.ok(
    observedShapes.every((shape) => shape !== undefined),
    "a hydrated route names no manifest entry",
  );
  assert.equal(
    new Set(observedShapes).size,
    observed.length,
    "two hydrated routes share a shape",
  );
  assert.deepEqual(
    [...new Set(observedShapes)].sort(),
    [...new Set(shapeByRoute.values())].sort(),
    "a manifest entry's shape has no hydrated route",
  );
});
