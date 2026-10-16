import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  command,
  publicationFixture,
  workspace,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);
test(
  "the real fault module is erased when Rust compiles without debug assertions",
  { timeout: 120_000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-release-fault-probe-"),
    );
    try {
      const modulePath = JSON.stringify(
        path.join(workspace, "crates/mokly-cli/src/test_faults/mod.rs"),
      );
      const source = path.join(root, "probe.rs");
      const binary = path.join(
        root,
        process.platform === "win32" ? "probe.exe" : "probe",
      );
      const prefix = `#[path = ${modulePath}] mod faults;\n`;
      await fs.writeFile(
        source,
        `${prefix}fn main() { assert!(!cfg!(debug_assertions)); }`,
      );
      const args = [
        "--edition=2024",
        "-C",
        "debug-assertions=no",
        source,
        "-o",
        binary,
      ];
      await exec("rustc", args);
      await exec(binary, [], {
        env: {
          ...process.env,
          MOKLY_TEST_STATIC_FAULTS: "config,stage,install",
        },
      });
      assert.ok(
        !(await fs.readFile(binary)).includes(
          Buffer.from("MOKLY_TEST_STATIC_FAULTS"),
        ),
      );
      await fs.writeFile(
        source,
        `${prefix}fn main() { let _ = faults::files; }`,
      );
      await assert.rejects(
        exec("rustc", args),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes("E0433") &&
          error.message.includes("faults"),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
test(
  "completed command sessions release signal registrations before another session starts",
  { timeout: 120_000, skip: process.platform === "win32" },
  async () => {
    const root = await publicationFixture();
    try {
      const result = await command(root, "build", ["--no-changes"], "plain", {
        MOKLY_TEST_STATIC_FAULTS: "handlers",
      }).result;
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stdout, "signal-handlers-released\n");
      assert.equal(result.stderr, "");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
