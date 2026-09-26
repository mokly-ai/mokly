import { setTimeout as delay } from "node:timers/promises";

import { loadConfig } from "../config/load.js";
import { MoklyError } from "../errors.js";
import { exportCatalogue } from "../export/run.js";
import { resolvePublishOptions } from "../publish/options.js";
import { publishCatalogue, type PublishProgress } from "../publish/run.js";
import type { PublishResult } from "../publish/types.js";
import { NodeGitCommandRunner } from "../review/git.js";

import type { CliArguments } from "./arguments.js";
import { reportPhase } from "./reporter/phase.js";
import { formatBytes } from "./reporter/terminal.js";
import type { CliReporter, ReporterPhase } from "./reporter/types.js";
import { packageVersion } from "./version.js";

/** Validate credentials first and drain export/upload work on termination signals. */
export async function runPublish(
  arguments_: CliArguments,
  cwd: string,
  reporter: CliReporter,
  env: NodeJS.ProcessEnv,
): Promise<PublishResult> {
  const options = resolvePublishOptions(arguments_, env);
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  let uploadPhase: ReporterPhase | undefined;
  const progress: PublishProgress = {
    run: async (phase, action) => {
      const copy = {
        export: ["Exporting catalogue", "Catalogue exported"],
        prepare: ["Preparing upload", "Upload prepared"],
        upload: ["Uploading catalogue", "Catalogue uploaded"],
      } as const;
      const [label, success] = copy[phase];
      if (phase !== "upload")
        return reportPhase(reporter, label, success, action);
      const active = reporter.startPhase(label);
      uploadPhase = active;
      try {
        const result = await action();
        active.succeed(success);
        return result;
      } catch (error) {
        active.fail();
        throw error;
      } finally {
        if (uploadPhase === active) uploadPhase = undefined;
      }
    },
    update: ({ completed, total, totalBytes }) =>
      uploadPhase?.update(
        total === 0
          ? "Uploading catalogue"
          : `Uploading ${completed} of ${total} files · ${formatBytes(totalBytes)}`,
      ),
  };
  try {
    const config = await reportPhase(
      reporter,
      "Loading configuration",
      "Configuration loaded",
      () => loadConfig(cwd, arguments_.config),
    );
    return await publishCatalogue(
      config,
      {
        ...arguments_,
        ...options,
        diagnostic: (message) => reporter.runtimeDiagnostic(message),
      },
      packageVersion(),
      env,
      {
        git: new NodeGitCommandRunner(config.repoRoot, controller.signal),
        export: exportCatalogue,
        fetch,
        now: () => new Date(),
        random: Math.random,
        sleep: async (milliseconds, signal) => {
          await delay(milliseconds, undefined, { signal });
        },
        progress,
      },
      controller.signal,
    );
  } catch (error) {
    if (error instanceof MoklyError) throw error;
    throw new MoklyError(
      "upload-failed",
      "Could not prepare the publication. Check local configuration and temporary storage before retrying.",
    );
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
