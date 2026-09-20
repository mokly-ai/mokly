import { execFile, type ChildProcess } from "node:child_process";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { promisify, stripVTControlCharacters } from "node:util";

import {
  NodeBaselineProcessScopeFactory,
  type BaselineProcessScope,
  type BaselineProcessScopeFactory,
} from "../../dist/baseline/process_scope.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import {
  PreviewOutputRetentionError,
  previewFixtureContextRoot,
  startOwnedPreviewFixture,
  type OwnedPreviewFixture,
  type PreviewEndpoint,
} from "./preview_fixture_owner.js";

const execute = promisify(execFile);
const MAX_DIAGNOSTIC_BYTES = 64 * 1_024;
const STARTUP_ATTEMPTS = 150;
const WRANGLER_EPHEMERAL_PORT = 0;
const WRANGLER_READY_ENDPOINT =
  /\[wrangler:info\]\s+Ready on (http:\/\/127\.0\.0\.1:\d+)\r?\n/;

/** Running Cloudflare Pages preview used by browser integration tests. */
export type PreviewFixture = PreviewEndpoint;

/** Observable process boundary used to verify startup cleanup. */
export interface PreviewServerProcess {
  readonly exited: boolean;
  readonly output: string;
  close(): Promise<void>;
}

interface PreviewServerOptions {
  readonly launch?: (
    artifact: string,
    port: number,
  ) => Promise<PreviewServerProcess>;
  readonly pause?: (milliseconds: number) => Promise<unknown>;
  readonly request?: (url: string) => Promise<{ readonly ok: boolean }>;
  readonly startupAttempts?: number;
}

interface PreviewProcessRequest {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
}

/** Run the real clean preview preparation and serve its owned output. */
export async function startPreviewFixture(
  includeChanges = false,
): Promise<OwnedPreviewFixture> {
  return startOwnedPreviewFixture({
    build: (output) =>
      timeFixturePhase(
        "preview-preparation",
        "preview:build",
        true,
        async () => {
          await execute(
            "npm",
            [
              "run",
              "preview:build",
              "--",
              "--out",
              output,
              ...(includeChanges ? ["--include-changes"] : []),
            ],
            { cwd: repositoryRoot, maxBuffer: 16 * 1_024 * 1_024 },
          );
        },
      ),
    contextRoot: previewFixtureContextRoot(
      path.join(repositoryRoot, ".context"),
    ),
    prefix: includeChanges
      ? "mokly-preview-changes-cold-"
      : "mokly-preview-cold-",
    serve: (artifact) =>
      timeFixturePhase("preview-preparation", "serve", false, () =>
        servePreviewFixture(artifact),
      ),
  });
}

/** Serve an already-published fixture through the real Pages routing runtime. */
export async function servePreviewFixture(
  artifact: string,
  options: PreviewServerOptions = {},
): Promise<PreviewFixture> {
  const child = await (options.launch ?? launchPreviewProcess)(
    artifact,
    WRANGLER_EPHEMERAL_PORT,
  );
  try {
    const url = await waitUntilReady(child, options);
    return { close: () => child.close(), url };
  } catch (error) {
    try {
      await child.close();
    } catch (cleanupError) {
      throw new PreviewOutputRetentionError(
        [error, cleanupError],
        "preview startup and process cleanup failed",
        cleanupError,
      );
    }
    throw error;
  }
}

async function launchPreviewProcess(
  artifact: string,
  port: number,
): Promise<PreviewServerProcess> {
  return startPreviewServerProcess({
    argv: [
      process.execPath,
      path.join(repositoryRoot, "node_modules/wrangler/bin/wrangler.js"),
      "pages",
      "dev",
      artifact,
      "--compatibility-date",
      "2026-07-28",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
    ],
    cwd: repositoryRoot,
    env: processEnvironment(),
  });
}

/** Start a process whose complete descendant tree is owned until close settles. */
export async function startPreviewServerProcess(
  request: PreviewProcessRequest,
  scopes: BaselineProcessScopeFactory = new NodeBaselineProcessScopeFactory(),
): Promise<PreviewServerProcess> {
  const scope = await scopes.create();
  let managed: ScopedPreviewProcess | undefined;
  try {
    const child = scope.spawn(request);
    managed = new ScopedPreviewProcess(child, scope);
    scope.start();
    return managed;
  } catch (error) {
    try {
      if (managed) await managed.close();
      else await scope.dispose();
    } catch (cleanupError) {
      throw new PreviewOutputRetentionError(
        [error, cleanupError],
        "preview launch and process cleanup failed",
        cleanupError,
      );
    }
    throw error;
  }
}

function processEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

class ScopedPreviewProcess implements PreviewServerProcess {
  private closing: Promise<void> | undefined;
  private readonly chunks: Buffer[] = [];
  private diagnosticBytes = 0;
  private processFailure: Error | undefined;
  private readonly launcherExited: Promise<void>;
  private readonly settled: Promise<void>;

  constructor(
    private readonly child: ChildProcess,
    private readonly scope: BaselineProcessScope,
  ) {
    child.stdout?.on("data", (chunk: Buffer) => this.capture(chunk));
    child.stderr?.on("data", (chunk: Buffer) => this.capture(chunk));
    let resolveLauncher = () => {};
    this.launcherExited = new Promise((resolve) => {
      resolveLauncher = resolve;
    });
    this.settled = new Promise((resolve) => {
      child.once("error", (error) => {
        this.processFailure = error;
        resolveLauncher();
        resolve();
      });
      child.once("exit", () => resolveLauncher());
      child.once("close", () => resolve());
    });
  }

  get exited(): boolean {
    return (
      this.processFailure !== undefined ||
      this.child.exitCode !== null ||
      this.child.signalCode !== null
    );
  }

  get output(): string {
    const diagnostic = Buffer.concat(this.chunks).toString("utf8");
    return this.processFailure
      ? `${diagnostic}${diagnostic ? "\n" : ""}${this.processFailure.message}`
      : diagnostic;
  }

  close(): Promise<void> {
    this.closing ??= this.closeOnce();
    return this.closing;
  }

  private capture(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.diagnosticBytes += chunk.byteLength;
    while (this.diagnosticBytes > MAX_DIAGNOSTIC_BYTES) {
      const removed = this.chunks.shift();
      if (!removed) break;
      this.diagnosticBytes -= removed.byteLength;
    }
  }

  private async closeOnce(): Promise<void> {
    const failures: unknown[] = [];
    try {
      this.scope.terminate("SIGTERM");
    } catch (error) {
      failures.push(error);
    }
    await boundedWait(this.launcherExited, 5_000);
    try {
      this.scope.terminate("SIGKILL");
    } catch (error) {
      failures.push(error);
    }
    if (!(await boundedWait(this.settled, 5_000))) {
      failures.push(new Error("preview launcher did not stop after SIGKILL"));
    }
    try {
      await this.scope.dispose();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "preview process-tree cleanup failed");
  }
}

async function boundedWait(
  operation: Promise<void>,
  milliseconds: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), milliseconds);
  });
  const completed = await Promise.race([
    operation.then(() => true as const),
    timeout,
  ]);
  clearTimeout(timer);
  return completed;
}

async function waitUntilReady(
  child: PreviewServerProcess,
  options: PreviewServerOptions,
): Promise<string> {
  const request = options.request ?? fetch;
  const wait = options.pause ?? pause;
  const attempts = options.startupAttempts ?? STARTUP_ATTEMPTS;
  let url: string | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exited)
      throw new Error(`preview exited before startup: ${child.output}`);
    // Port zero stays owned by workerd from selection through listen. Wrangler
    // reports the resulting loopback endpoint only after that bind succeeds;
    // Playwright may force terminal colours into the captured log stream.
    url ??= stripVTControlCharacters(child.output).match(
      WRANGLER_READY_ENDPOINT,
    )?.[1];
    try {
      if (url) {
        const response = await request(url);
        if (response.ok) return url;
      }
    } catch {
      // Wrangler can report the endpoint just before it accepts requests.
    }
    await wait(200);
  }
  throw new Error(`preview did not start: ${child.output}`);
}
