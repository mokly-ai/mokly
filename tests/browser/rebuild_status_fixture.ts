import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { RebuildStatus } from "@mokly/viewer/runtime";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
  type TestFixture,
} from "../helpers/fixture.js";
import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { interactiveShellSource } from "./interactive_shell_fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

/**
 * Holds one save's build open while a test observes the browser. The held
 * source blocks its own evaluation in the Serve process until `release()`.
 */
export interface BuildGate {
  /** Arm the gate before saving a held source. */
  arm(): Promise<void>;
  /** Resolve once the held source has started to load and is waiting. */
  entered(): Promise<void>;
  /** Let the held source finish loading. */
  release(): Promise<void>;
}

/** Entry sources a test can save into the watched fixture. */
export interface RebuildSources {
  /** A syntax error that fails at once, before any source runs. */
  readonly broken: string;
  /** The working catalogue. */
  readonly current: string;
  /** A change that waits on the gate, then fails or loads. */
  held(outcome: "fail" | "load"): string;
  /** A failure whose detail is long enough to scroll and wrap. */
  readonly long: string;
}

/** A real watched Serve over a Git baseline with Live previews enabled. */
export interface WatchedRebuildServe {
  close(): Promise<void>;
  readonly fixture: TestFixture;
  readonly gate: BuildGate;
  /**
   * Release the gate and return to the working source, waiting until a newer
   * served status is clean and idle, so no update leaks into the next test.
   */
  restore(): Promise<void>;
  /** Save one entry source; the watcher picks it up. */
  save(source: string): Promise<void>;
  readonly sources: RebuildSources;
  /** The status the server currently serves to a new page. */
  status(): Promise<RebuildStatus | undefined>;
  readonly url: string;
  /** Wait until a newly loaded page would receive a matching status. */
  waitForStatus(
    matches: (status: RebuildStatus) => boolean,
    timeoutMs?: number,
  ): Promise<RebuildStatus>;
}

/** The detail lines of the long failure, one of them a long unbroken token. */
export const LONG_DETAIL_LINES = [
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `entries/fixture.mockup.tsx:${index + 1}:3: this saved change could not be loaded`,
  ),
  `components/${"deeply-nested-folder/".repeat(12)}overflow-menu.tsx`,
];

function gateSource(gate: string, entered: string): string {
  return `
{
  const nodeFs = globalThis.process?.getBuiltinModule?.("node:fs");
  if (nodeFs?.existsSync(${JSON.stringify(gate)})) {
    nodeFs.writeFileSync(${JSON.stringify(entered)}, "");
    const pause = new Int32Array(new SharedArrayBuffer(4));
    while (nodeFs.existsSync(${JSON.stringify(gate)})) Atomics.wait(pause, 0, 0, 20);
  }
}
`;
}

function rebuildSources(gate: string, entered: string): RebuildSources {
  const current = interactiveShellSource(true);
  return {
    broken: current.replace(
      '<p id="count">{label}: {count}</p>',
      '<p id="count">{label}: {count}</h2>',
    ),
    current,
    held(outcome) {
      const waiting = `${current}${gateSource(gate, entered)}`;
      return outcome === "fail"
        ? `${waiting}throw new Error("The held change could not be loaded.");\n`
        : waiting.replaceAll('label="Home"', 'label="Held"');
    },
    long: `${current}throw new Error(${JSON.stringify(LONG_DETAIL_LINES.join("\n"))});\n`,
  };
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

async function until<T>(
  read: () => Promise<T | undefined>,
  label: string,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Read the private status a fresh page of this Serve would render. */
export async function servedStatus(
  url: string,
): Promise<RebuildStatus | undefined> {
  const html = await (await fetch(url)).text();
  const state = html.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  return state ? JSON.parse(state).rebuildStatus : undefined;
}

function listen(child: ChildProcess): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(
      () => reject(new Error(`serve did not start: ${buffered}`)),
      60_000,
    );
    child.stdout?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      const match = buffered.match(/Mokly listening at (http:\/\/[^\s]+)/);
      if (match?.[1] && buffered.includes("Mokly Live at ")) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
    });
    child.on("exit", (code) =>
      reject(new Error(`serve exited early with ${code}: ${buffered}`)),
    );
  });
}

/** Start a watched Serve whose baseline retires one screen. */
export async function watchedRebuildServe(): Promise<WatchedRebuildServe> {
  const fixture = await createFixture(interactiveShellSource(false), {
    extraConfig: 'interactive: "serve",',
  });
  const gates = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-gate-"));
  const gatePath = path.join(gates, "gate");
  const enteredPath = path.join(gates, "entered");
  fixture.beforeRemove(() => fs.rm(gates, { force: true, recursive: true }));
  try {
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("add", ".");
    git("commit", "-qm", "test: baseline");
    const sources = rebuildSources(gatePath, enteredPath);
    await fs.writeFile(fixture.entryPath, sources.current);
    const child = spawn(
      "node",
      [
        cli,
        "serve",
        "--config",
        fixture.configPath,
        "--port",
        "0",
        "--base",
        "HEAD",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    fixture.beforeRemove(async () => {
      if (child.exitCode !== null) return;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    });
    const url = await listen(child);
    await waitForInitialChanges(url, 120_000);
    const status = () => servedStatus(url);
    const waitForStatus = (
      matches: (status: RebuildStatus) => boolean,
      timeoutMs?: number,
    ) =>
      until(
        async () => {
          const current = await status();
          return current && matches(current) ? current : undefined;
        },
        "the served rebuild status",
        timeoutMs,
      );
    let saved = sources.current;
    const save = async (source: string) => {
      saved = source;
      await fs.writeFile(fixture.entryPath, source);
    };
    const release = () => fs.rm(gatePath, { force: true });
    return {
      close: () => removeFixture(fixture),
      fixture,
      gate: {
        async arm() {
          await fs.rm(enteredPath, { force: true });
          await fs.writeFile(gatePath, "");
        },
        entered: () =>
          until(
            async () => ((await exists(enteredPath)) ? true : undefined),
            "the held source to start loading",
          ).then(() => undefined),
        release,
      },
      async restore() {
        await release();
        if (saved !== sources.current) await save(sources.current);
        for (;;) {
          const clean = await waitForStatus(
            (current) => current.failure === null && !current.updating,
            120_000,
          );
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          if ((await status())?.sequence === clean.sequence) return;
        }
      },
      save,
      sources,
      status,
      url,
      waitForStatus,
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}
