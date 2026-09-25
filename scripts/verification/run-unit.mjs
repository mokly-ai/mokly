import { runUnitVerification } from "./unit-runner.mjs";

await runUnitVerification("strict", process.argv.slice(2));
