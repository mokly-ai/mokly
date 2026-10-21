import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { refreshChangedSourceMtimes } from "../scripts/verification/refresh-source-mtimes.mjs";

const execute = promisify(execFile);

test("changed Rust source becomes newer than the warmup build output", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-fresh-native-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const gitConfig = path.join(root, "empty.gitconfig");
  await fs.writeFile(gitConfig, "");
  const environment = {
    ...process.env,
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = async (...args: string[]) => {
    await execute("git", args, { cwd: root, env: environment });
  };
  await git("init", "--quiet", "--initial-branch=warmup");
  await git("config", "user.name", "Fresh native test");
  await git("config", "user.email", "fresh-native@example.invalid");
  await fs.mkdir(path.join(root, "crates/mokly-cli/src"), { recursive: true });
  await fs.mkdir(path.join(root, "target/debug"), { recursive: true });
  await fs.writeFile(path.join(root, ".gitignore"), "target/\n");
  const source = path.join(root, "crates/mokly-cli/src/lib.rs");
  const output = path.join(root, "target/debug/mokly");
  await fs.writeFile(source, "pub const PROBE: u8 = 1;\n");
  await fs.writeFile(output, "warmup binary\n");
  await git("add", ".");
  await git("commit", "--quiet", "-m", "test: warmup source");
  await fs.writeFile(source, "pub const PROBE: u8 = 2;\n");
  await fs.utimes(source, new Date(1_000), new Date(1_000));
  await fs.utimes(output, new Date(2_000), new Date(2_000));
  await git("add", source);

  await refreshChangedSourceMtimes(root);

  const sourceStat = await fs.stat(source);
  const outputStat = await fs.stat(output);
  assert.ok(
    sourceStat.mtimeMs > outputStat.mtimeMs,
    `source mtime ${sourceStat.mtimeMs} must be newer than output ${outputStat.mtimeMs}`,
  );
});
