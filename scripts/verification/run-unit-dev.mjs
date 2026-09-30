import { runUnitVerification } from "./unit-runner.mjs";

await runUnitVerification("developer", process.argv.slice(2));
