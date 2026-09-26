import type { BuildWarning } from "../build/warnings.js";
import { loadConfig } from "../config/load.js";
import { MoklyError } from "../errors.js";
import { exportCatalogue } from "../export/run.js";
import { resolvePublishOptions } from "../publish/options.js";
import { publishCatalogue } from "../publish/run.js";
import { NodeGitCommandRunner } from "../review/git.js";

import type { CliArguments } from "./arguments.js";
import { reportPhase } from "./reporter/phase.js";
import type { CliReporter } from "./reporter/types.js";
import { packageVersion } from "./version.js";

/** Validate credentials first and drain export/upload work on termination signals. */
export async function runPublish(
  arguments_: CliArguments,
  cwd: string,
  reporter: CliReporter,
  env: NodeJS.ProcessEnv,
  onWarning: (warning: BuildWarning) => void,
): Promise<void> {
  const options = resolvePublishOptions(arguments_, env);
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const config = await reportPhase(
      reporter,
      "Loading configuration",
      "Configuration loaded",
      () => loadConfig(cwd, arguments_.config, onWarning),
    );
    await publishCatalogue(
      config,
      {
        ...arguments_,
        ...options,
        diagnostic: (message) => reporter.runtimeDiagnostic(message),
        onWarning,
      },
      packageVersion(),
      env,
      {
        git: new NodeGitCommandRunner(config.repoRoot, controller.signal),
        export: exportCatalogue,
        fetch,
        now: () => new Date(),
        progress: {
          run: (phase, action) => {
            const copy = {
              export: ["Exporting catalogue", "Catalogue exported"],
              prepare: ["Preparing upload", "Upload prepared"],
              upload: ["Uploading catalogue", "Catalogue uploaded"],
            } as const;
            const [label, success] = copy[phase];
            return reportPhase(reporter, label, success, action);
          },
        },
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
