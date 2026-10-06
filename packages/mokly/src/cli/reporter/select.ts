import { PlainReporter } from "./plain.js";
import { RichReporter } from "./rich.js";
import type { CliReporter, OutputMode, TerminalEnvironment } from "./types.js";

/** Select plain compatibility or rich interaction using documented precedence. */
export function selectOutputMode(
  argv: readonly string[],
  stdoutIsTTY: boolean,
  env: NodeJS.ProcessEnv,
): OutputMode {
  if (argv[0] === "__serve-child") return "plain";
  if (argv.includes("--debug-timings")) return "plain";
  if (env.MOKLY_OUTPUT === "plain") return "plain";
  if (env.MOKLY_OUTPUT === "rich") return "rich";
  if (env.CI) return "plain";
  return stdoutIsTTY ? "rich" : "plain";
}

/** Construct the one reporter that owns an invocation's output. */
export function selectReporter(
  argv: readonly string[],
  environment: TerminalEnvironment,
): CliReporter {
  return selectOutputMode(
    argv,
    environment.stdout.isTTY ?? false,
    environment.env,
  ) === "rich"
    ? new RichReporter(environment)
    : new PlainReporter(environment);
}
