import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import { runColdPreviewBuild } from "../helpers/cold_preview_build.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";
import { waitUntil } from "../helpers/wait_until.js";

import {
  PreviewOutputRetentionError,
  previewFixtureContextRoot,
  startOwnedPreviewFixture,
  type OwnedPreviewFixture,
  type PreviewEndpoint,
} from "./preview_fixture_owner.js";
import {
  startPreviewServerProcess,
  type PreviewServerProcess,
} from "./preview_process.js";

const STARTUP_TIMEOUT_MS = 30_000;
const WRANGLER_EPHEMERAL_PORT = 0;
const WRANGLER_READY_ENDPOINT =
  /\[wrangler:info\]\s+Ready on (http:\/\/127\.0\.0\.1:\d+)\r?\n/;

/** Running Cloudflare Pages preview used by browser integration tests. */
export type PreviewFixture = PreviewEndpoint;

interface PreviewServerOptions {
  readonly launch?: (
    artifact: string,
    port: number,
  ) => Promise<PreviewServerProcess>;
  readonly request?: (url: string) => Promise<{ readonly ok: boolean }>;
}

/** Run the real clean preview preparation and serve its owned output. */
export async function startPreviewFixture(
  includeChanges = false,
): Promise<OwnedPreviewFixture> {
  return startOwnedPreviewFixture({
    artifactRelative: ".context/site",
    build: (output) =>
      timeFixturePhase(
        "preview-preparation",
        "preview:build",
        true,
        async () => {
          const fixtureRoot = path.dirname(path.dirname(output));
          await runColdPreviewBuild(fixtureRoot, output, includeChanges);
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

function processEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

async function waitUntilReady(
  child: PreviewServerProcess,
  options: PreviewServerOptions,
): Promise<string> {
  const request = options.request ?? fetch;
  let url: string | undefined;
  return waitUntil(
    async () => {
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
      return undefined;
    },
    {
      timeoutMs: STARTUP_TIMEOUT_MS,
      intervalMs: 200,
      message: () => `preview did not start: ${child.output}`,
    },
  );
}
