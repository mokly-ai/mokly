import { timeAsync } from "../diagnostics/timings.js";

import { validCommands } from "./cache_layout.js";
import {
  assertBaselineActive,
  BaselineCommandError,
  BaselineError,
} from "./errors.js";
import type { BaselineProcessRunner } from "./types.js";

/** Only documented executable lookup, user directories, locale and network configuration cross. */
export function baselineEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  commit: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment))
    if (
      value !== undefined &&
      /^(?:PATH|PATHEXT|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|SYSTEMROOT|WINDIR|COMSPEC|LANG|LANGUAGE|LC_[A-Z_]+|TMPDIR|TMP|TEMP|(?:HTTP|HTTPS|ALL|NO)_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|NPM_CONFIG_(?:PROXY|HTTPS_PROXY|NOPROXY|CAFILE|REGISTRY))$/i.test(
        key,
      )
    )
      result[key] = value;
  return { ...result, CI: "1", MOKLY_BASELINE_COMMIT: commit };
}

/** Execute the exact ordered argv list; no implicit commands or shell expansion. */
export async function runBaselineCommands(
  runner: BaselineProcessRunner,
  commands: readonly (readonly string[])[],
  cwd: string,
  env: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<void> {
  if (!validCommands(commands))
    throw new BaselineError(
      "baseline-command-failed",
      "Invalid baseline command list",
    );
  for (const [index, argv] of commands.entries()) {
    await timeAsync(`baseline.command[${index}]`, async () => {
      assertBaselineActive(signal);
      try {
        const result = await runner.run({
          argv,
          cwd,
          env,
          ...(signal ? { signal } : {}),
        });
        assertBaselineActive(signal);
        if (result.exitCode !== 0)
          throw new BaselineCommandError(
            index,
            [...argv],
            result.exitCode,
            result.signal,
            result.output
              .slice(-64 * 1024)
              .trimEnd()
              .split(/\r?\n/)
              .slice(-40),
          );
      } catch (error) {
        assertBaselineActive(signal);
        if (error instanceof BaselineError) throw error;
        throw new BaselineCommandError(index, [...argv], null, null, [], error);
      }
    });
  }
}
