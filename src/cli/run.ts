import path from "node:path";

import { enforceStrictBuildWarnings } from "../build/build_warnings.js";
import { compileCatalogue } from "../build/compile.js";
import { FileSystemGeneratedOutputStore } from "../build/output_store.js";
import { BuildWarningSink } from "../build/warning_sink.js";
import { loadConfig } from "../config/load.js";
import { runWithTimings, timeAsync } from "../diagnostics/timings.js";
import { runServerChild } from "../server/child.js";
import { receiveComponentRuntimeStartup } from "../server/controls/runtime_ipc.js";
import { serve } from "../server/serve.js";

import { parseArguments, type CliArguments } from "./arguments.js";
import { openServedBrowser } from "./browser.js";
import { watchBuild } from "./build_watch.js";
import { runExport } from "./export.js";
import { HELP } from "./help.js";
import {
  processTerminalEnvironment,
  reportPhase,
  selectReporter,
  type CliReporter,
  type TerminalEnvironment,
} from "./reporter/index.js";
import { redactCliSecrets } from "./secrets.js";
import { waitForShutdown } from "./serve_shutdown.js";
import { packageVersion } from "./version.js";

/** Execute one CLI invocation and return its process exit code. */
export async function run(
  argv: readonly string[],
  cwd = process.cwd(),
  environment: TerminalEnvironment = processTerminalEnvironment(),
  reporter: CliReporter = selectReporter(argv, environment),
): Promise<number> {
  const arguments_ = parseArguments(argv);
  if (arguments_.help) {
    reporter.write(HELP);
    return 0;
  }
  if (arguments_.version) {
    reporter.write(`${packageVersion()}\n`);
    return 0;
  }
  const warnings: BuildWarningSink = new BuildWarningSink((warning) =>
    arguments_.command === "__serve-child" && process.send
      ? process.send({
          type: "warning",
          generation: startupGeneration,
          warning,
        })
      : reporter.buildWarnings([
          {
            code: warning.code,
            ...(warning.subject
              ? {
                  subject: {
                    ...warning.subject,
                    path: redactCliSecrets(
                      warning.subject.path,
                      argv,
                      environment.env,
                    ),
                  },
                }
              : {
                  route: redactCliSecrets(warning.route, argv, environment.env),
                }),
            message: redactCliSecrets(warning.message, argv, environment.env),
          },
        ]),
  );
  const startupGeneration = warnings.generation;
  try {
    return await runWithTimings(
      arguments_.debugTimings ?? false,
      arguments_.command === "__serve-child" ? "child" : arguments_.command,
      () => execute(arguments_, cwd, environment, reporter, warnings),
    );
  } catch (error) {
    warnings.flush();
    throw error;
  }
}

async function execute(
  arguments_: CliArguments,
  cwd: string,
  environment: TerminalEnvironment,
  reporter: CliReporter,
  warnings: BuildWarningSink,
): Promise<number> {
  const startedAt = environment.now();
  if (arguments_.command === "publish") {
    const publish = await import("./publish.js");
    const outputPresentation = await import("./publish_output.js");
    const result = await timeAsync("publish", () =>
      publish.runPublish(arguments_, cwd, reporter, environment.env, warnings),
    );
    warnings.flush();
    const output = outputPresentation.publishOutput(
      result,
      arguments_.token ?? environment.env.MOKLY_TOKEN,
    );
    reporter.summary(output.plain, output.rich, environment.now() - startedAt);
    if (output.viewerUrl) reporter.write(`${output.viewerUrl}\n`);
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
      () =>
        timeAsync("config.load", () =>
          loadConfig(cwd, arguments_.config, warnings.forGeneration()),
        ),
    ));
  if (arguments_.command === "export") {
    const result = await reportPhase(
      reporter,
      "Exporting catalogue",
      "Catalogue exported",
      () =>
        timeAsync("export", () =>
          runExport(config, {
            onWarning: (warning) => warnings.add(warning),
            diagnostic: (message) => reporter.runtimeDiagnostic(message),
            incompatibleBaseline: (commit) =>
              reporter.incompatibleBaseline(commit),
            onBuildDiagnostics: (diagnostics) => {
              warnings.complete(diagnostics);
              enforceStrictBuildWarnings(
                diagnostics,
                arguments_.strict ?? false,
              );
            },
            outDir: arguments_.out ?? "",
            ...(arguments_.base !== undefined ? { base: arguments_.base } : {}),
          }),
        ),
    );
    warnings.flush();
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
    if (arguments_.watch) {
      await watchBuild(
        config,
        cwd,
        reporter,
        undefined,
        undefined,
        arguments_.strict ?? false,
      );
      return 0;
    }
    const compilation = await reportPhase(
      reporter,
      "Rendering catalogue",
      "Catalogue rendered",
      () =>
        compileCatalogue(config, undefined, undefined, (warning) =>
          warnings.add(warning),
        ),
    );
    warnings.complete(compilation.diagnostics);
    enforceStrictBuildWarnings(
      compilation.diagnostics,
      arguments_.strict ?? false,
    );
    await reportPhase(
      reporter,
      "Writing generated output",
      "Generated output written",
      () => outputStore.write(compilation, config),
    );
    warnings.flush();
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
      () =>
        compileCatalogue(config, undefined, undefined, (warning) =>
          warnings.add(warning),
        ),
    );
    warnings.complete(compilation.diagnostics);
    enforceStrictBuildWarnings(
      compilation.diagnostics,
      arguments_.strict ?? false,
    );
    const tracking = await reportPhase(
      reporter,
      "Checking generated output",
      "Generated output checked",
      () =>
        timeAsync("output.check", async () =>
          outputStore.check(compilation, config),
        ),
    );
    const untracked = tracking === "untracked";
    reporter.summary(
      untracked
        ? `Mokly output is valid and untracked (${compilation.outputs.size} files).\n`
        : `Mokly output is current (${compilation.outputs.size} files).\n`,
      untracked
        ? `Mokly output is valid and untracked · ${compilation.outputs.size} files`
        : `Mokly output is current · ${compilation.outputs.size} files`,
      environment.now() - startedAt,
    );
    return 0;
  }
  const base = arguments_.base ?? config.review.base;
  const port = arguments_.port ?? 4173;
  if (arguments_.command === "__serve-child") {
    if (!runtimeStartup) {
      config.diagnostics?.forEach((warning) => warnings.add(warning));
      warnings.flush();
    }
    await runServerChild(
      config,
      port,
      base,
      arguments_.updateVersion ?? 1,
      arguments_.strictPort ?? false,
      arguments_.retainedRuntime ?? false,
      runtimeStartup?.manifest,
      (warning) => warnings.add(warning),
    );
    return 0;
  }
  const running = await timeAsync("serve.ready", () =>
    serve(
      config,
      {
        ...(arguments_.base !== undefined ? { base: arguments_.base } : {}),
        port,
        build: arguments_.build ?? false,
        watch: arguments_.watch ?? true,
      },
      { reporter, warnings },
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
