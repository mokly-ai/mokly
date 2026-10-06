import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  COVERAGE_GENERATED_ROOTS,
  COVERAGE_SOURCE_ROOTS,
  coverageIncludeGlobs,
  evaluateThresholds,
  formatCoverageSummary,
  parseThresholds,
  selectCoverageFiles,
  summarizeCoverage,
} from "../scripts/verification/coverage.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const nodeFile = (
  file: string,
  counts: readonly [number, number, number, number, number, number],
) => ({
  path: path.join(repositoryRoot, file),
  coveredLineCount: counts[0],
  totalLineCount: counts[1],
  coveredBranchCount: counts[2],
  totalBranchCount: counts[3],
  coveredFunctionCount: counts[4],
  totalFunctionCount: counts[5],
});

test("coverage thresholds are validated before any test runs", () => {
  assert.deepEqual(
    parseThresholds({ lines: 80, branches: 70.5, functions: 0 }),
    {
      lines: 80,
      branches: 70.5,
      functions: 0,
    },
  );
  assert.throws(() => parseThresholds(null), /JSON object/u);
  assert.throws(() => parseThresholds([80]), /JSON object/u);
  assert.throws(
    () => parseThresholds({ lines: 80, branches: 70, functions: 60, extra: 1 }),
    /unknown coverage threshold keys: extra/u,
  );
  assert.throws(
    () => parseThresholds({ lines: 80, branches: 70 }),
    /threshold functions must be a number from 0 to 100/u,
  );
  assert.throws(
    () => parseThresholds({ lines: 101, branches: 70, functions: 60 }),
    /threshold lines must be a number from 0 to 100/u,
  );
  assert.throws(
    () => parseThresholds({ lines: "80", branches: 70, functions: 60 }),
    /threshold lines must be a number from 0 to 100/u,
  );
});

test("the committed thresholds file is valid", async () => {
  const thresholds = parseThresholds(
    JSON.parse(
      await fs.readFile(
        path.join(
          repositoryRoot,
          "scripts/verification/coverage-thresholds.json",
        ),
        "utf8",
      ),
    ),
  );
  for (const percent of Object.values(thresholds)) assert.ok(percent > 0);
});

test("a test selection must come from the discovered unit inventory", () => {
  const inventory = ["tests/a.test.ts", "tests/b.test.ts"];
  assert.deepEqual(selectCoverageFiles(inventory, []), {
    complete: true,
    files: inventory,
  });
  assert.deepEqual(
    selectCoverageFiles(inventory, ["./tests/b.test.ts", "tests/b.test.ts"]),
    { complete: false, files: ["tests/b.test.ts"] },
  );
  assert.throws(
    () => selectCoverageFiles(inventory, ["--shard", "1/4"]),
    /usage: run-coverage\.mjs \[TEST_FILE\.\.\.\]/u,
  );
  assert.throws(
    () => selectCoverageFiles(inventory, ["src/index.ts"]),
    /src\/index\.ts is not a discovered unit test file/u,
  );
});

test("Node's include globs cover generated output so source maps apply", () => {
  assert.deepEqual(coverageIncludeGlobs(), [
    "src/**",
    "packages/viewer/src/**",
    "dist/**",
    "packages/viewer/dist/**",
  ]);
  assert.deepEqual(COVERAGE_SOURCE_ROOTS, ["src", "packages/viewer/src"]);
  assert.deepEqual(COVERAGE_GENERATED_ROOTS, ["dist", "packages/viewer/dist"]);
});

test("the summary keeps source files, excludes unmapped output, and totals counts", () => {
  const summary = summarizeCoverage(
    {
      files: [
        nodeFile("src/b.ts", [3, 4, 1, 2, 1, 1]),
        nodeFile("dist/unmapped.js", [9, 9, 9, 9, 9, 9]),
        nodeFile("packages/viewer/src/a.tsx", [1, 4, 0, 0, 0, 3]),
        nodeFile("src/a.ts", [0, 2, 1, 1, 2, 2]),
      ],
    },
    repositoryRoot,
  );
  assert.deepEqual(
    summary.files.map((record) => record.file),
    ["packages/viewer/src/a.tsx", "src/a.ts", "src/b.ts"],
  );
  assert.deepEqual(
    summary.unmapped.map((record) => record.file),
    ["dist/unmapped.js"],
  );
  assert.deepEqual(summary.files[0]?.branches, {
    covered: 0,
    total: 0,
    percent: 100,
  });
  assert.deepEqual(summary.totals, {
    lines: { covered: 4, total: 10, percent: 40 },
    branches: { covered: 2, total: 3, percent: (2 / 3) * 100 },
    functions: { covered: 3, total: 6, percent: 50 },
  });
});

test("threshold findings name each metric below its minimum", () => {
  const totals = {
    lines: { covered: 4, total: 10, percent: 40 },
    branches: { covered: 2, total: 3, percent: (2 / 3) * 100 },
    functions: { covered: 3, total: 6, percent: 50 },
  };
  assert.deepEqual(
    evaluateThresholds(totals, { lines: 40, branches: 66.66, functions: 50 }),
    [],
  );
  assert.deepEqual(
    evaluateThresholds(totals, { lines: 40.01, branches: 70, functions: 50 }),
    [
      "lines coverage 40.00% is below the 40.01% threshold",
      "branches coverage 66.67% is below the 70.00% threshold",
    ],
  );
});

test("the printed summary ranks the least covered files first", () => {
  const summary = summarizeCoverage(
    {
      files: [
        nodeFile("src/high.ts", [10, 10, 2, 2, 2, 2]),
        nodeFile("src/low.ts", [1, 10, 0, 2, 0, 2]),
        nodeFile("src/middle.ts", [5, 10, 1, 2, 1, 2]),
        nodeFile("dist/left.js", [1, 1, 1, 1, 1, 1]),
      ],
    },
    repositoryRoot,
  );
  const lines = formatCoverageSummary(summary, { lowest: 2 });
  assert.deepEqual(lines, [
    "coverage lines 53.33% (16/30), branches 50.00% (3/6), functions 50.00% (3/6)",
    "lowest line coverage (2 files):",
    "   10.00% src/low.ts (1/10)",
    "   50.00% src/middle.ts (5/10)",
    "generated files without source mapping, excluded from totals (1):",
    "  dist/left.js",
  ]);
  assert.deepEqual(formatCoverageSummary(summary, { lowest: 5 }).slice(1, 2), [
    "lowest line coverage (3 files):",
  ]);
});
