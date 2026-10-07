import fs from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import type { TestInfo } from "@playwright/test";

import type { PreviewServerProcess } from "./preview_process.js";

/** Log lines that a timed-out test prints for each preview server. */
export const PRINTED_PREVIEW_LOG_LINES = 40;

const EMPTY_LOG = "The log is empty.";

/** Lifetime state of a preview server when its test ended. */
export type PreviewServerState = "closed" | "exited" | "running";

/** Retained output of one preview server that a failed test can report. */
export interface PreviewServerLog {
  readonly output: string;
  readonly state: PreviewServerState;
  readonly url: string;
}

/** Test result fields that decide which preview server logs to keep. */
export type PreviewLogTestInfo = Pick<
  TestInfo,
  "expectedStatus" | "outputPath" | "status" | "titlePath"
>;

type PreviewServerOutput = Pick<PreviewServerProcess, "exited" | "output">;

interface TrackedPreviewServer {
  readonly child: PreviewServerOutput;
  closed: boolean;
  readonly url: string;
}

const trackedServers = new Set<TrackedPreviewServer>();

/**
 * Include a ready preview server in this worker's failure reports. The
 * returned callback marks it closed; a server closed during a test's own
 * teardown is still reported for that test.
 */
export function trackPreviewServer(
  child: PreviewServerOutput,
  url: string,
): () => void {
  const server: TrackedPreviewServer = { child, closed: false, url };
  trackedServers.add(server);
  return () => {
    server.closed = true;
  };
}

/** Logs of the tracked servers, in the order the worker started them. */
export function trackedPreviewServerLogs(): PreviewServerLog[] {
  return [...trackedServers].map(({ child, closed, url }) => ({
    output: child.output,
    state: closed ? "closed" : child.exited ? "exited" : "running",
    url,
  }));
}

/**
 * Run one test, then report the logs of the preview servers that ran
 * during it. Servers closed before the test started are not reported.
 */
export async function runWithPreviewServerLogs(
  testInfo: PreviewLogTestInfo,
  run: () => Promise<void>,
  write: (text: string) => void,
): Promise<void> {
  forgetClosedServers();
  await run();
  try {
    await reportPreviewServerLogs(testInfo, trackedPreviewServerLogs(), write);
  } finally {
    forgetClosedServers();
  }
}

/**
 * Save each server log to the test output directory when the test fails or
 * times out, and print where it is. A timeout also prints each log's tail.
 */
export async function reportPreviewServerLogs(
  testInfo: PreviewLogTestInfo,
  servers: readonly PreviewServerLog[],
  write: (text: string) => void,
): Promise<void> {
  const { status } = testInfo;
  const failed = status === "failed" || status === "timedOut";
  if (!failed || status === testInfo.expectedStatus || servers.length === 0)
    return;
  const outcome = status === "timedOut" ? "Test timed out" : "Test failed";
  const heading = `${outcome}: ${testInfo.titlePath.join(" › ")}`;
  const report = [`[mokly:preview-server-log] ${heading}`];
  for (const [index, server] of servers.entries()) {
    const lines = logLines(server.output);
    const label = `Preview server ${server.url} (${server.state})`;
    const file = testInfo.outputPath(`preview-server-${index + 1}.log`);
    report.push(
      `${label}. ${await saveLog(file, `${label}\n${heading}`, lines)}`,
    );
    if (status === "timedOut") report.push(...logTail(lines));
  }
  write(`${report.join("\n")}\n`);
}

function forgetClosedServers(): void {
  for (const server of trackedServers)
    if (server.closed) trackedServers.delete(server);
}

function logLines(output: string): string[] {
  const lines = stripVTControlCharacters(output)
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function logTail(lines: readonly string[]): string[] {
  if (lines.length === 0) return [EMPTY_LOG];
  const tail = lines.slice(-PRINTED_PREVIEW_LOG_LINES);
  return [
    `Last ${tail.length} of ${lines.length} log lines:`,
    ...tail.map((line) => `  ${line}`),
  ];
}

async function saveLog(
  file: string,
  header: string,
  lines: readonly string[],
): Promise<string> {
  const shown = path.relative(process.cwd(), file);
  const body = lines.length > 0 ? lines.join("\n") : EMPTY_LOG;
  try {
    await fs.writeFile(file, `${header}\n\n${body}\n`);
    return `Full log: ${shown}`;
  } catch (error) {
    return `The full log was not saved to ${shown}: ${(error as Error).message}`;
  }
}
