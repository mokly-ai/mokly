import { runCoverageVerification } from "./coverage-runner.mjs";

const summary = await runCoverageVerification(process.argv.slice(2));
if (summary.outcome.status !== "passed") process.exitCode = 1;
