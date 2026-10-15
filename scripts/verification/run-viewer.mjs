import { ExpectedFailure } from "./expected-failure.mjs";
import { runViewerVerification } from "./viewer-runner.mjs";

const args = process.argv.slice(2);
const strict = args[0] === "--strict";
if (strict) args.shift();
try {
  await runViewerVerification(strict ? "strict" : "developer", args);
} catch (error) {
  if (!(error instanceof ExpectedFailure)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
