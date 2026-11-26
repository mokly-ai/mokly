import type {
  BrowserContext,
  ElectronApplication,
  Page,
} from "@playwright/test";

/** How many of the last output lines each Electron process keeps. */
const keptLines = 200;

const outputs = new WeakMap<BrowserContext, string[]>();

/**
 * The environment that makes Electron write Chromium's own log, such as a GPU
 * process exit or a lost context, to its standard error.
 */
export const chromiumLogging = { ELECTRON_ENABLE_LOGGING: "1" };

/**
 * Keep the last lines that the Electron process writes, so that a failed
 * capture can print what Chromium said before it. Playwright already reads
 * both pipes, so this listener adds no back-pressure.
 */
export function keepOutput(electron: ElectronApplication): void {
  const lines: string[] = [];
  outputs.set(electron.context(), lines);
  const child = electron.process();
  for (const [name, stream] of [
    ["stdout", child.stdout],
    ["stderr", child.stderr],
  ] as const) {
    let partial = "";
    stream?.on("data", (chunk: Buffer) => {
      const parts = (partial + chunk.toString("utf8")).split("\n");
      partial = parts.pop() ?? "";
      for (const line of parts) {
        lines.push(`[electron ${name}] ${line}`);
        if (lines.length > keptLines) lines.shift();
      }
    });
  }
}

/** Print the kept Electron output of the page's application and the error. */
export function printCaptureFailure(
  page: Page,
  name: string,
  error: unknown,
): void {
  const lines = outputs.get(page.context());
  const output = lines
    ? [`Last ${lines.length} lines of Electron output:`, ...lines]
    : ["The page is not an Electron window, so no Electron output is kept."];
  console.error(
    [
      `Screenshot "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      ...output,
    ].join("\n"),
  );
}
