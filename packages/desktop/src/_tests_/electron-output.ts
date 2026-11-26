import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  BrowserContext,
  ElectronApplication,
  Page,
} from "@playwright/test";

/** How many of the last Chromium log lines a failed capture prints. */
const printedLines = 200;

const logFiles = new WeakMap<BrowserContext, string>();
let launches = 0;

/**
 * The switches that make Chromium write its own log, such as a GPU process
 * exit or a lost context, to a file of this launch from the process start.
 * Each launch gets its own file, so a second launch of one profile does not
 * mix its lines with the first.
 */
export function chromiumLog(profile: string): {
  args: string[];
  file: string;
} {
  launches += 1;
  const file = join(profile, `chromium-${process.pid}-${launches}.log`);
  return { args: ["--enable-logging=file", `--log-file=${file}`], file };
}

/** Remember the log file of a launched application for its windows. */
export function keepLog(electron: ElectronApplication, file: string): void {
  logFiles.set(electron.context(), file);
}

/** The last lines of the page's Chromium log, or why there are none. */
function logTail(page: Page): string[] {
  const file = logFiles.get(page.context());
  if (!file)
    return ["The page is not an Electron window, so it has no Chromium log."];
  try {
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    const tail = lines.slice(-printedLines);
    return [`Last ${tail.length} lines of the Chromium log ${file}:`, ...tail];
  } catch (error) {
    return [`The Chromium log ${file} could not be read: ${String(error)}`];
  }
}

/** Print the Chromium log of the page's application and the capture error. */
export function printCaptureFailure(
  page: Page,
  name: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    [`Screenshot "${name}" failed: ${message}`, ...logTail(page)].join("\n"),
  );
}
