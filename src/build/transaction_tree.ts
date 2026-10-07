import fs from "node:fs";
import path from "node:path";

import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../errors.js";

import type { Compilation } from "./compile.js";

/** Keep all transaction artifacts beside the generated tree on the same filesystem. */
export async function replaceGeneratedTree(
  compilation: Compilation,
  destination: string,
): Promise<void> {
  const parent = path.dirname(destination);
  await fs.promises.mkdir(parent, { recursive: true });
  await rejectUnrecoveredBackup(destination);
  await assertDisposableTree(destination);
  const temporaryRoot = await fs.promises.mkdtemp(
    path.join(parent, `.mokly-write-${path.basename(destination)}-`),
  );
  const stage = path.join(temporaryRoot, "stage");
  const backup = path.join(temporaryRoot, "backup");
  let oldTreeMoved = false;
  let installed = false;
  let restored = false;
  try {
    await timeAsync("output.stage", async () => {
      await fs.promises.mkdir(stage);
      for (const [route, content] of [...compilation.outputs].sort(
        ([left], [right]) => left.localeCompare(right),
      )) {
        const target = path.join(stage, route);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, content, "utf8");
      }
      await assertDisposableTree(stage);
    });
    await timeAsync("output.install", async () => {
      if (await existing(destination)) {
        await fs.promises.rename(destination, backup);
        oldTreeMoved = true;
      }
      await fs.promises.rename(stage, destination);
      installed = true;
    });
  } catch (error) {
    if (oldTreeMoved && !installed) {
      try {
        await timeAsync("output.rollback", () =>
          fs.promises.rename(backup, destination),
        );
        restored = true;
      } catch (rollbackError) {
        throw new MoklyError(
          "build-invalid",
          `could not restore the previous generated tree from ${backup}: ${errorMessage(rollbackError)}; install failed: ${errorMessage(error)}`,
          { cause: rollbackError },
        );
      }
    }
    throw new MoklyError(
      "build-invalid",
      `could not commit generated output: ${errorMessage(error)}`,
      { cause: error },
    );
  } finally {
    if (!oldTreeMoved || installed || restored) {
      try {
        await timeAsync("output.cleanup", () =>
          fs.promises.rm(temporaryRoot, { recursive: true, force: true }),
        );
      } catch (error) {
        console.warn(
          `Mokly generated output ${installed ? "installed" : "unchanged"}; remove leftover transaction ${temporaryRoot}: ${errorMessage(error)}`,
        );
      }
    }
  }
}

async function existing(candidate: string): Promise<boolean> {
  try {
    await fs.promises.lstat(candidate);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function rejectUnrecoveredBackup(destination: string): Promise<void> {
  if (await existing(destination)) return;
  const parent = path.dirname(destination);
  const prefix = `.mokly-write-${path.basename(destination)}-`;
  for (const entry of (
    await fs.promises.readdir(parent, { withFileTypes: true })
  ).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.name.startsWith(prefix) || !entry.isDirectory()) continue;
    const backup = path.join(parent, entry.name, "backup");
    if (await existing(backup))
      throw new MoklyError(
        "build-invalid",
        `previous generated tree may be in ${backup}; restore the backup or remove the leftover transaction before building`,
      );
  }
}

/** Never inspect through a symlink in the disposable tree, including its root. */
async function assertDisposableTree(root: string): Promise<void> {
  if (!(await existing(root))) return;
  const status = await fs.promises.lstat(root);
  if (status.isSymbolicLink())
    throw new MoklyError(
      "build-invalid",
      `generated tree contains a symbolic link: ${root}`,
    );
  if (!status.isDirectory())
    throw new MoklyError(
      "build-invalid",
      `generated tree is not a directory: ${root}`,
    );
  for (const entry of await fs.promises.readdir(root, {
    withFileTypes: true,
  })) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink())
      throw new MoklyError(
        "build-invalid",
        `generated tree contains a symbolic link: ${candidate}`,
      );
    if (entry.isDirectory()) await assertDisposableTree(candidate);
    else if (!entry.isFile())
      throw new MoklyError(
        "build-invalid",
        `generated tree contains a non-regular file: ${candidate}`,
      );
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
