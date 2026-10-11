import { ExpectedFailure } from "./expected-failure.mjs";
import { runUnitVerification } from "./unit-runner.mjs";

try {
  await runUnitVerification("developer", process.argv.slice(2));
} catch (error) {
  if (!(error instanceof ExpectedFailure)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
