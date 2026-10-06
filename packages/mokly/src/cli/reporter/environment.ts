import { NodeBrowserOpener } from "../browser.js";

import type { TerminalEnvironment } from "./types.js";

/** Real process terminal environment used outside injected tests. */
export function processTerminalEnvironment(): TerminalEnvironment {
  return {
    browserOpener: new NodeBrowserOpener(process.platform),
    env: process.env,
    now: Date.now,
    platform: process.platform,
    stderr: process.stderr,
    stdin: process.stdin,
    stdout: process.stdout,
  };
}
