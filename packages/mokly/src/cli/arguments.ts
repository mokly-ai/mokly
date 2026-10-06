import { MoklyError } from "../errors.js";

/** Supported user-visible and hidden process commands. */
export type CliCommand =
  "__serve-child" | "build" | "check" | "export" | "publish" | "serve";

/** Fully validated CLI arguments. */
export interface CliArguments {
  base?: string;
  command: CliCommand;
  config?: string;
  debugTimings?: boolean;
  endpoint?: string;
  token?: string;
  uploadConcurrency?: number;
  repository?: string;
  noChanges?: boolean;
  open?: boolean;
  help: boolean;
  out?: string;
  port?: number;
  strictPort?: boolean;
  retainedRuntime?: boolean;
  updateVersion?: number;
  version: boolean;
  watch?: boolean;
}

const COMMANDS = new Set<CliCommand>([
  "__serve-child",
  "build",
  "check",
  "export",
  "publish",
  "serve",
]);

/** Parse Mokly arguments without accepting silent positional values. */
export function parseArguments(argv: readonly string[]): CliArguments {
  const values = [...argv];
  let command: CliCommand = "serve";
  if (values[0] && !values[0].startsWith("-")) {
    const candidate = values.shift() as string;
    if (!COMMANDS.has(candidate as CliCommand)) {
      throw new MoklyError("cli-invalid", `unknown command: ${candidate}`);
    }
    command = candidate as CliCommand;
  }
  const parsed: CliArguments = { command, help: false, version: false };
  while (values.length > 0) {
    const argument = values.shift()!;
    const separator = argument.indexOf("=");
    const option = separator < 0 ? argument : argument.slice(0, separator);
    const assigned = separator < 0 ? undefined : argument.slice(separator + 1);
    if (argument === "--help" || argument === "-h") parsed.help = true;
    else if (argument === "--version" || argument === "-v")
      parsed.version = true;
    else if (argument === "--debug-timings") parsed.debugTimings = true;
    else if (argument === "--watch") parsed.watch = true;
    else if (argument === "--no-watch") parsed.watch = false;
    else if (argument === "--open") parsed.open = true;
    else if (argument === "--retained-runtime") parsed.retainedRuntime = true;
    else if (argument === "--strict-port") parsed.strictPort = true;
    else if (option === "--config")
      parsed.config = takeValue(option, values, assigned);
    else if (option === "--base")
      parsed.base = takeValue(option, values, assigned);
    else if (option === "--out")
      parsed.out = takeValue(option, values, assigned);
    else if (option === "--endpoint")
      parsed.endpoint = takeValue(option, values, assigned);
    else if (option === "--token")
      parsed.token = takeValue(option, values, assigned);
    else if (option === "--repository")
      parsed.repository = takeValue(option, values, assigned);
    else if (option === "--upload-concurrency")
      parsed.uploadConcurrency = parseUploadConcurrency(
        takeValue(option, values, assigned),
      );
    else if (argument === "--no-changes") parsed.noChanges = true;
    else if (option === "--port")
      parsed.port = parsePort(takeValue(option, values, assigned));
    else if (option === "--update-version")
      parsed.updateVersion = parseUpdateVersion(
        takeValue(option, values, assigned),
      );
    else throw new MoklyError("cli-invalid", `unknown option: ${argument}`);
  }
  validateCommandOptions(parsed);
  return parsed;
}

function parseUploadConcurrency(value: string): number {
  if (!/^(?:[1-9]|[12]\d|3[0-2])$/.test(value))
    throw new MoklyError(
      "cli-invalid",
      "--upload-concurrency must be an integer from 1 to 32",
    );
  return Number(value);
}

function parseUpdateVersion(value: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new MoklyError(
      "cli-invalid",
      "--update-version must be a positive safe integer",
    );
  }
  return version;
}

function takeValue(
  option: string,
  values: string[],
  assigned?: string,
): string {
  const value = assigned ?? values.shift();
  if (!value || (assigned === undefined && value.startsWith("-"))) {
    throw new MoklyError("cli-invalid", `${option} requires a value`);
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new MoklyError(
      "cli-invalid",
      "--port must be an integer from 0 to 65535",
    );
  }
  return port;
}

function validateCommandOptions(arguments_: CliArguments): void {
  if (arguments_.retainedRuntime && arguments_.command !== "__serve-child")
    throw new MoklyError(
      "cli-invalid",
      "--retained-runtime is reserved for the watched server child",
    );
  if (
    arguments_.out !== undefined &&
    arguments_.command !== "export" &&
    arguments_.command !== "publish"
  )
    throw new MoklyError("cli-invalid", "--out belongs to export or publish");
  if (
    arguments_.command !== "publish" &&
    (arguments_.endpoint !== undefined ||
      arguments_.token !== undefined ||
      arguments_.repository !== undefined ||
      arguments_.noChanges !== undefined ||
      arguments_.uploadConcurrency !== undefined)
  )
    throw new MoklyError(
      "cli-invalid",
      "--endpoint, --token, --repository, --no-changes and --upload-concurrency belong to publish",
    );
  if (arguments_.noChanges && arguments_.base !== undefined)
    throw new MoklyError(
      "cli-invalid",
      "--no-changes cannot be combined with --base",
    );
  if (arguments_.out?.trim() === "")
    throw new MoklyError("cli-invalid", "--out requires a value");
  if (
    arguments_.command === "export" &&
    arguments_.out === undefined &&
    !arguments_.help &&
    !arguments_.version
  )
    throw new MoklyError("cli-invalid", "--out is required for export");
  const serve =
    arguments_.command === "serve" || arguments_.command === "__serve-child";
  if (
    !serve &&
    (arguments_.port !== undefined || arguments_.watch !== undefined)
  ) {
    throw new MoklyError(
      "cli-invalid",
      "--port and --watch options belong to serve",
    );
  }
  if (arguments_.open && arguments_.command !== "serve")
    throw new MoklyError("cli-invalid", "--open belongs to serve");
  if (
    arguments_.command !== "__serve-child" &&
    arguments_.updateVersion !== undefined
  ) {
    throw new MoklyError(
      "cli-invalid",
      "--update-version is reserved for the watched server child",
    );
  }
  if (
    arguments_.command !== "__serve-child" &&
    arguments_.strictPort !== undefined
  ) {
    throw new MoklyError(
      "cli-invalid",
      "--strict-port is reserved for the watched server child",
    );
  }
  if (arguments_.command === "build" || arguments_.command === "check") {
    if (arguments_.base !== undefined)
      throw new MoklyError(
        "cli-invalid",
        "--base belongs to serve, export or publish",
      );
  }
}
