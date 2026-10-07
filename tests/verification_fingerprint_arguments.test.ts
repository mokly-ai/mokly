import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import * as sourceTree from "../scripts/verification/source-tree.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const message =
  "expected fingerprint must match sha256:<64 lowercase hex digits>";
const sourceUsage =
  "usage: source-tree.mjs [--expect sha256:<digest>] [--print-head]";
const testboxUsage =
  "usage: testbox-suite.mjs --expect <fingerprint> --suite <suite> [--shard INDEX/TOTAL] [--dependency-audit baseline|strict]";

test("the shared fingerprint validator accepts the exact value and has no usage text", () => {
  assert.equal(typeof sourceTree.validateFingerprint, "function");
  const valid = `sha256:${"a".repeat(64)}`;
  assert.equal(sourceTree.validateFingerprint(valid), valid);
  for (const value of [
    undefined,
    null,
    1,
    "",
    "invalid",
    `${valid}\n`,
    `sha256:${"A".repeat(64)}`,
  ]) {
    assert.throws(() => sourceTree.validateFingerprint(value), { message });
  }
});

test("source-tree fingerprint errors use only the source-tree usage line", async (context) => {
  const cwd = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-fingerprint-source-"),
  );
  context.after(() => fs.rm(cwd, { recursive: true, force: true }));
  for (const args of [["--expect"], ["--expect", "invalid"]]) {
    await assert.rejects(
      execute(
        process.execPath,
        [
          path.join(repositoryRoot, "scripts/verification/source-tree.mjs"),
          ...args,
        ],
        { cwd },
      ),
      (error: unknown) => {
        const result = error as {
          code: number;
          stdout: string;
          stderr: string;
        };
        assert.equal(result.code, 1);
        assert.equal(result.stdout, "");
        assert.equal(
          result.stderr,
          `[verification/source-tree] ${message}; ${sourceUsage}\n`,
        );
        return true;
      },
    );
  }
});

test("testbox-suite fingerprint errors use only the testbox-suite usage line", async (context) => {
  const cwd = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-fingerprint-testbox-"),
  );
  context.after(() => fs.rm(cwd, { recursive: true, force: true }));
  for (const args of [
    ["--suite", "unit"],
    ["--expect", "invalid", "--suite", "unit"],
  ]) {
    await assert.rejects(
      execute(
        process.execPath,
        [
          path.join(repositoryRoot, "scripts/verification/testbox-suite.mjs"),
          ...args,
        ],
        { cwd },
      ),
      (error: unknown) => {
        const result = error as {
          code: number;
          stdout: string;
          stderr: string;
        };
        assert.equal(result.code, 1);
        assert.equal(result.stdout, "");
        assert.equal(
          result.stderr,
          `[verification/testbox-suite] ${message}; ${testboxUsage}\n`,
        );
        return true;
      },
    );
  }
});
