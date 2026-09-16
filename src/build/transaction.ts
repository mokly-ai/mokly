import fs from "node:fs";
import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../errors.js";

import type { Compilation } from "./compile.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import {
  generatedOwnershipDenial,
  pendingGeneratedOrphanRoutes,
} from "./ownership.js";

/** Atomically replace owned generated files with rollback on any failure. */
export async function writeCompilation(
  compilation: Compilation,
  config: ResolvedConfig,
): Promise<void> {
  return timeAsync("output.write", () => writeMeasured(compilation, config));
}

async function writeMeasured(
  compilation: Compilation,
  config: ResolvedConfig,
): Promise<void> {
  const destinationConfig = config;
  config = { ...config, sourceFiles: compilation.manifest.sourceFiles };
  timeSync("output.validate-targets", () =>
    rejectUnsafeTargets(compilation, config),
  );
  await fs.promises.mkdir(path.dirname(config.mockupsDir), { recursive: true });
  const temporaryRoot = await fs.promises.mkdtemp(
    path.join(path.dirname(config.mockupsDir), ".mokly-write-"),
  );
  const stageRoot = path.join(temporaryRoot, "stage");
  const backupRoot = path.join(temporaryRoot, "backup");
  const expected = [...compilation.outputs.keys()].sort();
  const orphan = timeSync("output.find-orphans", () =>
    pendingGeneratedOrphanRoutes(config, expected),
  );
  const affected = [...new Set([...expected, ...orphan])].sort();
  const backedUp: string[] = [];
  const installed: string[] = [];
  try {
    await timeAsync("output.stage", async () => {
      for (const route of expected) {
        const staged = path.join(stageRoot, route);
        await fs.promises.mkdir(path.dirname(staged), { recursive: true });
        await fs.promises.writeFile(
          staged,
          compilation.outputs.get(route) ?? "",
          "utf8",
        );
      }
    });
    await timeAsync("output.backup", async () => {
      for (const route of affected) {
        const target = path.join(config.mockupsDir, route);
        if (!fs.existsSync(target)) continue;
        const backup = path.join(backupRoot, route);
        await fs.promises.mkdir(path.dirname(backup), { recursive: true });
        await fs.promises.rename(target, backup);
        backedUp.push(route);
      }
    });
    await timeAsync("output.install", async () => {
      for (const route of expected) {
        const target = path.join(config.mockupsDir, route);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.rename(path.join(stageRoot, route), target);
        installed.push(route);
      }
    });
  } catch (error) {
    await timeAsync("output.rollback", () =>
      rollback(config, backupRoot, installed, backedUp),
    );
    throw new MoklyError(
      "build-invalid",
      `could not commit generated output: ${errorMessage(error)}`,
      {
        cause: error,
      },
    );
  } finally {
    await timeAsync("output.cleanup", () =>
      fs.promises.rm(temporaryRoot, { force: true, recursive: true }),
    );
  }
  destinationConfig.sourceFiles = compilation.manifest.sourceFiles;
}

function rejectUnsafeTargets(
  compilation: Compilation,
  config: ResolvedConfig,
): void {
  validateGeneratedOutputPaths(compilation.outputs.keys(), config);
  for (const route of compilation.outputs.keys()) {
    const target = path.join(config.mockupsDir, route);
    if (!fs.existsSync(target)) continue;
    const denial = generatedOwnershipDenial(target, config);
    if (denial) {
      throw new MoklyError(
        "build-invalid",
        `refusing to overwrite unowned file: ${route} (${denial})`,
      );
    }
  }
}

async function rollback(
  config: ResolvedConfig,
  backupRoot: string,
  installed: readonly string[],
  backedUp: readonly string[],
): Promise<void> {
  for (const route of [...installed].reverse()) {
    await fs.promises.rm(path.join(config.mockupsDir, route), { force: true });
  }
  for (const route of [...backedUp].reverse()) {
    const target = path.join(config.mockupsDir, route);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.rename(path.join(backupRoot, route), target);
  }
}
