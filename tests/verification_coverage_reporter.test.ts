import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { lcovTracefile } from "../scripts/verification/coverage-reporter.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("the lcov tracefile matches Node's reporter format", () => {
  const tracefile = lcovTracefile({
    workingDirectory: "/repo",
    files: [
      {
        path: "/repo/src/subject.ts",
        lines: [
          { line: 2, count: 1 },
          { line: 1, count: 1 },
          { line: 3, count: 0 },
        ],
        branches: [
          { line: 1, count: 1 },
          { line: 3, count: 0 },
        ],
        functions: [
          { name: "covered", line: 1, count: 1 },
          { name: "", line: 3, count: 0 },
        ],
        totalLineCount: 3,
        coveredLineCount: 2,
        totalBranchCount: 2,
        coveredBranchCount: 1,
        totalFunctionCount: 2,
        coveredFunctionCount: 1,
      },
    ],
  });
  assert.equal(
    tracefile,
    [
      "TN:",
      "SF:src/subject.ts",
      "FN:1,covered",
      "FN:3,anonymous_1",
      "FNDA:1,covered",
      "FNDA:0,anonymous_1",
      "FNF:2",
      "FNH:1",
      "BRDA:1,0,0,1",
      "BRDA:3,1,0,0",
      "BRF:2",
      "BRH:1",
      "DA:1,1",
      "DA:2,1",
      "DA:3,0",
      "LH:2",
      "LF:3",
      "end_of_record",
      "",
    ].join("\n"),
  );
});

test("the coverage reporter retains Node's summary and fails closed", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-coverage-reporter-"),
  );
  try {
    const output = path.join(root, "coverage.json");
    const lcov = path.join(root, "lcov.info");
    const nodeLcov = path.join(root, "node-lcov.info");
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      MOKLY_COVERAGE_LCOV: lcov,
      MOKLY_COVERAGE_REPORT: output,
    };
    delete environment.NODE_TEST_CONTEXT;
    const reporter = [
      "--test-reporter=./scripts/verification/coverage-reporter.mjs",
      "--test-reporter-destination=stdout",
      "scripts/verification/_fixtures_/coverage-run.mjs",
    ];
    await execute(
      process.execPath,
      [
        "--test",
        "--experimental-test-coverage",
        "--test-coverage-include=scripts/verification/_fixtures_/**",
        "--test-reporter=lcov",
        `--test-reporter-destination=${nodeLcov}`,
        ...reporter,
      ],
      { cwd: repositoryRoot, env: environment },
    );
    const report = JSON.parse(await fs.readFile(output, "utf8"));
    assert.equal(report.reporterComplete, true);
    const subject = report.summary.files.find((file: { path: string }) =>
      file.path.endsWith("coverage-subject.mjs"),
    );
    assert.ok(subject, JSON.stringify(report.summary.files));
    assert.equal(subject.totalFunctionCount, 2);
    assert.equal(subject.coveredFunctionCount, 1);
    const tracefile = await fs.readFile(lcov, "utf8");
    assert.equal(tracefile, await fs.readFile(nodeLcov, "utf8"));
    assert.match(
      tracefile,
      /^SF:scripts\/verification\/_fixtures_\/coverage-subject\.mjs$/mu,
    );
    assert.match(tracefile, /^FNDA:0,uncovered$/mu);
    assert.match(tracefile, /^FNF:2\nFNH:1$/mu);
    assert.match(tracefile, /^end_of_record$/mu);
    await fs.rm(lcov);

    await execute(process.execPath, ["--test", ...reporter], {
      cwd: repositoryRoot,
      env: environment,
    });
    const withoutCoverage = JSON.parse(await fs.readFile(output, "utf8"));
    await assert.rejects(fs.stat(lcov));
    assert.deepEqual(withoutCoverage, {
      reporterComplete: true,
      summary: null,
    });

    delete environment.MOKLY_COVERAGE_REPORT;
    await assert.rejects(
      execute(process.execPath, ["--test", ...reporter], {
        cwd: repositoryRoot,
        env: environment,
      }),
      (error: { stderr?: string }) => {
        assert.match(error.stderr ?? "", /MOKLY_COVERAGE_REPORT is required/u);
        return true;
      },
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});
