import path from "node:path";

import { start, stop } from "./process.mjs";
import { prepareFixture, preparedFixture } from "./setup.mjs";

const repository = path.resolve(import.meta.dirname, "../..");
async function main() {
  const args = process.argv.slice(2);
  const mode = args.shift();
  if (!["generate", "serve", "benchmark"].includes(mode))
    throw new Error("Use generate, serve or benchmark");
  const size = {
    areas: 30,
    screens: 40,
    rows: 12,
    stylesheets: 4,
    stylesheetShare: 0.5,
  };
  let debug = mode === "benchmark";
  let config;
  let trackedOutput = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--debug-timings") debug = true;
    else if (flag === "--tracked-output") trackedOutput = true;
    else if (flag === "--config") {
      const value = args.shift();
      if (!value || value.startsWith("--"))
        throw new Error("--config needs a path");
      config = path.resolve(value);
    } else if (flag === "--stylesheet-share") {
      const value = Number(args.shift());
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new Error("--stylesheet-share needs a number between 0 and 1");
      size.stylesheetShare = value;
    } else if (flag === "--stylesheets") {
      const value = Number(args.shift());
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("--stylesheets needs a non-negative integer");
      size.stylesheets = value;
    } else if (["--areas", "--screens", "--rows"].includes(flag)) {
      const value = Number(args.shift());
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${flag} needs a positive integer`);
      size[flag.slice(2)] = value;
    } else throw new Error(`Unknown fixture option: ${flag}`);
  }
  if (size.screens < 2)
    throw new Error("screens must be at least two per area");
  if (mode === "generate")
    return prepareFixture(repository, size, debug, trackedOutput);
  const fixture = config
    ? { configPath: config, root: path.dirname(config), size }
    : await preparedFixture(repository, size, trackedOutput);
  if (mode === "benchmark") {
    const { benchmark } = await import("./benchmark.mjs");
    return benchmark(repository, fixture);
  }
  const running = start(
    [
      path.join(repository, "dist/cli/bin.js"),
      "serve",
      "--config",
      fixture.configPath,
      "--port",
      "0",
      ...(debug ? ["--debug-timings"] : []),
    ],
    fixture.root,
  );
  const forward = () => void stop(running);
  process.once("SIGINT", forward);
  process.once("SIGTERM", forward);
  try {
    await running.done;
  } finally {
    await stop(running);
    process.off("SIGINT", forward);
    process.off("SIGTERM", forward);
  }
}
main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
