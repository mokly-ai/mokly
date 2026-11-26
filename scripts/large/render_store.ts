import fs from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import { waitFor } from "./process.js";
import type { Running } from "./process.js";
import { finishRun } from "./run_output.js";

interface Announcement {
  directory: string;
  source: string;
}
export interface RenderStorePreparation {
  scenario: string;
  measured: false;
  status: "preparing" | "ready" | "failed";
  cacheDirectory: string | null;
  directory: string | null;
  announcedBy: string | null;
  discoveryMs: number;
  resetMs: number | null;
  elapsedMs: number;
  reason?: string;
}

/** Empty one kind without changing source, dependency, or bundle entries. */
export async function resetRenderStore(namespace: string) {
  const directory = path.join(namespace, "renders");
  const beginning = performance.now();
  await fs.rm(directory, { recursive: true, force: true });
  return { directory, elapsedMs: performance.now() - beginning };
}

/** Use only complete announcements from children owned by one benchmark call. */
export function renderStorePreparation(
  root: string,
  startServe: () => Running,
) {
  let latest: Announcement | undefined;
  const preparations: RenderStorePreparation[] = [];
  const current = () => latest;

  function observe(running: Running, source: string) {
    const decoder = new StringDecoder("utf8");
    let partial = "";
    let directory: string | null = null;
    const accept = (chunk: string | Uint8Array) => {
      const lines = (
        partial +
        (typeof chunk === "string" ? chunk : decoder.write(Buffer.from(chunk)))
      ).split("\n");
      partial = lines.pop() ?? "";
      for (const line of lines) {
        const announced = line.match(/^Mokly cache: ([^\r\n]+)\r?$/u)?.[1];
        if (!announced || !path.isAbsolute(announced)) continue;
        directory = announced;
        latest = { directory, source };
      }
    };
    running.child.stdout.on("data", accept);
    running.child.once("close", () => {
      running.child.stdout.off("data", accept);
    });
    return {
      directory: () => directory,
      output: () => (directory === null ? "" : `Mokly cache: ${directory}\n`),
    };
  }

  async function discover(scenario: string) {
    const name = `${scenario}-cache-discovery`;
    const running = startServe();
    const announcement = observe(running, name);
    try {
      await waitFor(
        { ...running, output: announcement.output },
        /^Mokly cache: ([^\r\n]+)\n$/u,
      );
    } finally {
      await finishRun(root, name, running);
    }
  }

  async function cold(scenario: string) {
    const beginning = performance.now();
    const preparation: RenderStorePreparation = {
      scenario,
      measured: false,
      status: "preparing",
      cacheDirectory: null,
      directory: null,
      announcedBy: null,
      discoveryMs: 0,
      resetMs: null,
      elapsedMs: 0,
    };
    preparations.push(preparation);
    try {
      if (!current()) {
        const discoveryStart = performance.now();
        try {
          await discover(scenario);
        } finally {
          preparation.discoveryMs = performance.now() - discoveryStart;
        }
      }
      const announcement = current();
      if (!announcement)
        throw new Error("Serve did not announce its cache namespace");
      preparation.cacheDirectory = announcement.directory;
      preparation.announcedBy = announcement.source;
      const reset = await resetRenderStore(announcement.directory);
      preparation.directory = reset.directory;
      preparation.resetMs = reset.elapsedMs;
      preparation.status = "ready";
    } catch (error) {
      preparation.status = "failed";
      preparation.reason =
        error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      preparation.elapsedMs = performance.now() - beginning;
    }
  }

  return { observe, cold, preparations };
}
