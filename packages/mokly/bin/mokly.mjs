#!/usr/bin/env node
import { systemRuntime } from "../dist/runtime.mjs";
import { runShim } from "../dist/shim.mjs";

try {
  process.exitCode = await runShim(process.argv.slice(2), systemRuntime());
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Mokly could not start.";
  const safe = Array.from(message, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159) ? " " : character;
  }).join("");
  process.stderr.write(`[mokly/cli-invalid] ${safe}\n`);
  process.exitCode = 1;
}
