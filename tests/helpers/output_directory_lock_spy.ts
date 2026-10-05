import assert from "node:assert/strict";
import fs from "node:fs";
import type { TestContext } from "node:test";

import { outputLockPath } from "../../dist/build/output_lock.js";
import { isInside } from "../../dist/config/paths.js";
import type { ResolvedConfig } from "../../dist/config/types.js";

/** Observe every output-tree mutation while leaving private lock-directory cleanup separate. */
export function spyOutputDirectoryLock(t: TestContext, config: ResolvedConfig) {
  type Operation = "mkdir" | "rmdir" | "rename" | "rm";
  const calls: { operation: Operation; directory: string }[] = [];
  const mkdir = fs.promises.mkdir,
    rmdir = fs.promises.rmdir,
    rename = fs.promises.rename,
    rm = fs.promises.rm;
  const inspect = (operation: Operation, candidate: fs.PathLike) => {
    const directory = String(candidate);
    if (!isInside(config.mockupsDir, directory)) return;
    assert.ok(
      fs.existsSync(outputLockPath(config.repoRoot)),
      `${operation} ${directory} requires the writer lock`,
    );
    calls.push({ operation, directory });
  };
  t.mock.method(fs.promises, "mkdir", (...args: Parameters<typeof mkdir>) => {
    inspect("mkdir", args[0]);
    return Reflect.apply(mkdir, fs.promises, args);
  });
  t.mock.method(fs.promises, "rmdir", (...args: Parameters<typeof rmdir>) => {
    inspect("rmdir", args[0]);
    return Reflect.apply(rmdir, fs.promises, args);
  });
  t.mock.method(fs.promises, "rename", (...args: Parameters<typeof rename>) => {
    inspect("rename", args[0]);
    inspect("rename", args[1]);
    return Reflect.apply(rename, fs.promises, args);
  });
  t.mock.method(fs.promises, "rm", (...args: Parameters<typeof rm>) => {
    inspect("rm", args[0]);
    return Reflect.apply(rm, fs.promises, args);
  });
  return calls;
}
