#!/usr/bin/env node

import { errorMessage } from "../errors.js";

import {
  processTerminalEnvironment,
  selectReporter,
} from "./reporter/index.js";
import { run } from "./run.js";
import { redactCliSecrets } from "./secrets.js";

const argv = process.argv.slice(2);
const environment = processTerminalEnvironment();
const reporter = selectReporter(argv, environment);
try {
  process.exitCode = await run(argv, process.cwd(), environment, reporter);
} catch (error) {
  const redact = (message: string) =>
    redactCliSecrets(message, argv, environment.env);
  const supervisedChild = argv[0] === "__serve-child" && process.send;
  if (supervisedChild)
    process.send?.({
      type: "diagnostic",
      message: redact(errorMessage(error)),
    });
  else reporter.renderError(error, redact);
  if (
    environment.env.MOKLY_DIAGNOSTIC === "1" &&
    error instanceof Error &&
    error.stack
  ) {
    const stack = redact(error.stack);
    if (supervisedChild)
      process.send?.({ type: "diagnostic", message: stack.slice(0, 65_536) });
    else reporter.diagnostic(stack);
  }
  process.exitCode = 1;
} finally {
  reporter.close();
}
