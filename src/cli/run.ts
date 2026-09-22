import path from "node:path";

import { compileCatalogue } from "../build/compile.js";
import { FileSystemGeneratedOutputStore } from "../build/output_store.js";
import { loadConfig } from "../config/load.js";
import { runWithTimings, timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { runServerChild } from "../server/child.js";
import { receiveComponentRuntimeStartup } from "../server/controls/runtime_ipc.js";
import { serve, type RunningServe } from "../server/serve.js";

import { parseArguments, type CliArguments } from "./arguments.js";
import { openServedBrowser } from "./browser.js";
import { runExport } from "./export.js";
import { HELP } from "./help.js";
import { runPublish } from "./publish.js";
import {
  processTerminalEnvironment,
  reportPhase,
  selectReporter,
  ServeShortcuts,
  type CliReporter,
  type TerminalEnvironment,
} from "./reporter/index.js";
import { packageVersion } from "./version.js";

/** Execute one CLI invocation and return its process exit code. */
export async function run(
  argv: readonly string[],
  cwd = process.cwd(),
  environment: TerminalEnvironment = processTerminalEnvironment(),
  reporter: CliReporter = selectReporter(argv, environment),
): Promise<number> {
  assertSupportedNode();
  const arguments_ = parseArguments(argv);
  if (arguments_.help) {
    reporter.write(HELP);
    return 0;
  }
  if (arguments_.version) {
    reporter.write(`${packageVersion()}\n`);
    return 0;
  }
  return runWithTimings(
    arguments_.debugTimings ?? false,
    arguments_.command === "__serve-child" ? "child" : arguments_.command,
    () => execute(arguments_, cwd, environment, reporter),
  );
}

async function execute(
  arguments_: CliArguments,
  cwd: string,
  environment: TerminalEnvironment,
  reporter: CliReporter,
): Promise<number> {
  const startedAt = environment.now();
  if (arguments_.command === "publish") {
    await timeAsync("publish", () =>
      runPublish(arguments_, cwd, reporter, environment.env),
    );
    reporter.summary(
      "Published Mokly catalogue.\n",
      "Published Mokly catalogue",
      environment.now() - startedAt,
    );
    return 0;
  }
  const runtimeStartup =
    arguments_.command === "__serve-child" && arguments_.retainedRuntime
      ? await timeAsync("child.startup-transfer", () =>
          receiveComponentRuntimeStartup(),
        )
      : undefined;
  const config =
    runtimeStartup?.config ??
    (await reportPhase(
      reporter,
      "Loading configuration",
      "Configuration loaded",
      () => timeAsync("config.load", () => loadConfig(cwd, arguments_.config)),
    ));
  if (arguments_.command === "export") {
    const result = await reportPhase(
      reporter,
      "Exporting catalogue",
      "Catalogue exported",
      () =>
        timeAsync("export", () =>
          runExport(config, {
            diagnostic: (message) => reporter.runtimeDiagnostic(message),
            outDir: arguments_.out ?? "",
            ...(arguments_.base !== undefined ? { base: arguments_.base } : {}),
          }),
        ),
    );
    reporter.summary(
      `Exported Mokly to ${result.outDir}.\nDeploy this directory at your site's root with your hosting provider.\n`,
      `Exported Mokly to ${result.outDir}`,
      environment.now() - startedAt,
    );
    if (reporter.mode === "rich")
      reporter.write(
        "Deploy this directory at your site's root with your hosting provider.\n",
      );
    return 0;
  }
  const outputStore = new FileSystemGeneratedOutputStore();
  if (arguments_.command === "build") {
    const compilation = await reportPhase(
      reporter,
      "Rendering catalogue",
      "Catalogue rendered",
      () => compileCatalogue(config),
    );
    await reportPhase(
      reporter,
      "Writing generated output",
      "Generated output written",
      () => outputStore.write(compilation, config),
    );
    reporter.summary(
      `Generated ${compilation.outputs.size} Mokly files.\n`,
      `Generated ${compilation.outputs.size} files in ${relativeOutput(cwd, config.mockupsDir)}`,
      environment.now() - startedAt,
    );
    return 0;
  }
  if (arguments_.command === "check") {
    const compilation = await reportPhase(
      reporter,
      "Rendering catalogue",
      "Catalogue rendered",
      () => compileCatalogue(config),
    );
    await reportPhase(
      reporter,
      "Checking generated output",
      "Generated output checked",
      () =>
        timeAsync("output.check", async () =>
          outputStore.check(compilation, config),
        ),
    );
    const derived = config.generatedOutput === "derived";
    reporter.summary(
      derived
        ? `Mokly output is valid and untracked (${compilation.outputs.size} files).\n`
        : `Mokly output is current (${compilation.outputs.size} files).\n`,
      derived
        ? `Mokly output is valid and untracked · ${compilation.outputs.size} files`
        : `Mokly output is current · ${compilation.outputs.size} files`,
      environment.now() - startedAt,
    );
    return 0;
  }
  const base = arguments_.base ?? config.review.base;
  const port = arguments_.port ?? 4173;
  if (arguments_.command === "__serve-child") {
    await runServerChild(
      config,
      port,
      base,
      arguments_.updateVersion ?? 1,
      arguments_.strictPort ?? false,
      arguments_.retainedRuntime ?? false,
      runtimeStartup?.manifest,
    );
    return 0;
  }
  const running = await timeAsync("serve.ready", () =>
    serve(
      config,
      {
        ...(arguments_.base !== undefined ? { base: arguments_.base } : {}),
        port,
        watch: arguments_.watch ?? true,
      },
      { reporter },
    ),
  );
  const shutdown = waitForShutdown(
    running,
    environment,
    reporter,
    arguments_.watch ?? true,
  );
  reporter.serveReady({
    base,
    configPath:
      path.relative(cwd, config.configPath) || path.basename(config.configPath),
    generatedOutput: config.generatedOutput,
    url: running.url,
    version: packageVersion(),
    watch: arguments_.watch ?? true,
  });
  if (arguments_.open)
    await openServedBrowser(environment.browserOpener, reporter, running.url);
  await shutdown;
  return 0;
}

function relativeOutput(cwd: string, output: string): string {
  return path.relative(cwd, output) || ".";
}

function waitForShutdown(
  running: RunningServe,
  environment: TerminalEnvironment,
  reporter: CliReporter,
  watched: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
    const onSignal = (): void => void close();
    const shortcuts = new ServeShortcuts(environment, reporter, {
      clear: () => reporter.clearServe(),
      close: onSignal,
      help: () => reporter.showShortcuts(),
      open: async () => {
        await openServedBrowser(
          environment.browserOpener,
          reporter,
          running.url,
        );
      },
      rebuild: () => running.rebuild?.(),
    });
    const cleanup = (): void => {
      shortcuts.close();
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };
    const close = async (): Promise<void> => {
      if (closing) return;
      closing = true;
      try {
        await running.close();
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    if (watched) shortcuts.start();
  });
}

function assertSupportedNode(): void {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 14)) {
    throw new MoklyError(
      "cli-invalid",
      `Node.js 22.14 or newer is required; found ${process.versions.node}`,
    );
  }
}
