import fs from "node:fs/promises";

/** Start the longest observed shards early so they do not extend the tail. */
export function verificationTasks() {
  return [
    { key: "repository", suite: "repository" },
    { key: "hydration", suite: "hydration" },
    { key: "browser-2", suite: "browser", index: 2 },
    { key: "unit-4", suite: "unit", index: 4 },
    { key: "package", suite: "package" },
    { key: "browser-3", suite: "browser", index: 3 },
    { key: "browser-4", suite: "browser", index: 4 },
    { key: "browser-1", suite: "browser", index: 1 },
    { key: "unit-1", suite: "unit", index: 1 },
    { key: "unit-2", suite: "unit", index: 2 },
    { key: "unit-3", suite: "unit", index: 3 },
  ];
}

/** Reserve compiler and browser headroom without weakening test deadlines. */
export function localWorkerLimit(available) {
  return Math.max(1, Math.min(4, Math.floor(available / 3)));
}

/** A cancellation-caused worker exit must not replace the initiating signal. */
export function primaryCheckError(error, interrupted) {
  return interrupted ?? error;
}

/** Preserve a failed shard's evidence for diagnosis without accepting it. */
export async function collectWorkerReport(source, destination, required) {
  let contents;
  try {
    contents = await fs.readFile(source, "utf8");
  } catch (error) {
    if (required) throw error;
    return undefined;
  }
  await fs.copyFile(source, destination);
  try {
    return JSON.parse(contents);
  } catch (error) {
    if (required) throw error;
    return undefined;
  }
}

/** Surface the originating test when a worker exits unsuccessfully. */
export function workerFailure(key, outcome, report) {
  const detail = (report?.failures ?? [])
    .slice(0, 2)
    .map((failure) => `${failure.name}: ${failure.diagnostic}`)
    .join("\n");
  const exit = outcome.signal ?? outcome.interrupted ?? outcome.exitCode;
  return new Error(`${key} failed (${exit})${detail ? `\n${detail}` : ""}`);
}
