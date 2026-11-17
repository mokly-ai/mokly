import { spawn } from "node:child_process";
import {
  existsSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";

import { saveApiEnvironment, savedApiEnvironment } from "./api-environment";
import { databaseSkipReason } from "./database";
import {
  startStripeDouble,
  stopStripeDouble,
  stripeOrigin,
} from "./stripe-double";
import { githubEnvironment } from "./github-double";
import { apiBind, apiOrigin, stripeWebhookSecret } from "./origins";
import {
  cleanupPublicationRuntime,
  preparePublicationRuntime,
  publicationEnvironment,
} from "./publication-runtime";
import {
  apiLogPath,
  openServerLog,
  repositoryRoot,
  runtimeDirectory,
  stopRecorded,
} from "./server-process";
import type { StartOutcome } from "./server-process";

// Keep the shared harness entry point stable for app and desktop consumers.
export { apiOrigin, appOrigin } from "./origins";
export { startCatalogue, stopCatalogue } from "./catalogue-server";
export {
  cleanupPublicationRuntime,
  previewSignInEmail,
  previewSignInSecret,
} from "./publication-runtime";
export { apiLogPath, catalogueLogPath } from "./server-process";
export type { StartOutcome } from "./server-process";

const pidPath = resolve(runtimeDirectory, "api.pid");
const startupLimitMs = 600_000;

/** Compile the App's test server before a browser test's own timeout starts. */
export async function prepareBuildApi(): Promise<void> {
  const logPath = resolve(runtimeDirectory, "fake-build-api-build.log");
  const log = openSync(logPath, "w");
  try {
    const child = spawn(
      "cargo",
      ["build", "--locked", "-p", "mkc-api", "--example", "fake-build-api"],
      {
        cwd: repositoryRoot,
        env: { ...process.env, RUSTC_WRAPPER: "" },
        stdio: ["ignore", log, log],
        timeout: startupLimitMs,
      },
    );
    await new Promise<void>((done, fail) => {
      child.once("error", fail);
      child.once("exit", (code) => {
        if (code === 0) done();
        else
          fail(new Error(`The fake build API did not compile. See ${logPath}`));
      });
    });
  } finally {
    closeSync(log);
  }
}

/** The test-only runner's separate loopback control listener. */
export const buildControlAddressPath = resolve(
  runtimeDirectory,
  "build-control-address.txt",
);

async function responds(): Promise<boolean> {
  try {
    const response = await fetch(apiOrigin + "/v1/session");
    return response.status > 0;
  } catch {
    return false;
  }
}

async function waitForApi(deadlineMs: number): Promise<boolean> {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    if (await responds()) return true;
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

/**
 * What the API needs to run with billing configured. Every billing surface is
 * a real read of the API's own database, so the suite has to give the API a
 * provider to reach: the loopback double answers the prices it verifies at
 * startup and the subscription its webhook worker retrieves, and nothing the
 * reader sees is invented anywhere in between. A deployment with no billing
 * is the pane's own unavailable state, which a test reaches by routing the
 * reason the API would answer with, exactly as it reaches every other answer
 * this environment cannot produce.
 */
const billingEnvironment = {
  MKC_BILLING: "stripe",
  MKC_STRIPE_SECRET_KEY: "sk_test_appsuitefixture",
  MKC_STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  MKC_STRIPE_API_ORIGIN: stripeOrigin,
};

/**
 * Start the real API for the browser tests. Nothing here fakes a server: every
 * assertion runs against `mkc-api` with the development mailer, which is how
 * the sign-in link reaches the test. Only an unreachable database skips the
 * suite; a port held by something this run did not start is a failure, because
 * a skip that looks like a pass is worse than no suite at all. `github`
 * configures the recorded GitHub, which the caller has already started; a suite
 * that starts none leaves the integration off.
 */
export async function startApi(
  options: { github?: boolean } = {},
): Promise<StartOutcome> {
  const skip = databaseSkipReason();
  if (skip) return { skip };
  mkdirSync(runtimeDirectory, { recursive: true });
  if (await responds()) {
    // Never adopt a listener this run did not start. A leftover log from an
    // earlier run says nothing about the process answering now, and a suite
    // that reads someone else's sign-in links is a green run that tested
    // nothing.
    return {
      failure:
        `Another server is already listening on ${apiOrigin}. Stop it, or ` +
        "set MKC_API_PORT and MKC_APP_PORT, so the suite runs against the " +
        "API it started itself.",
    };
  }
  preparePublicationRuntime();
  const environment = { ...publicationEnvironment() };
  saveApiEnvironment(environment);
  // Before the API, because the API resolves both prices from the catalogue
  // lookup keys as it starts.
  try {
    await startStripeDouble();
  } catch (error) {
    cleanupPublicationRuntime();
    throw error;
  }
  const outcome = await launchApi(environment, options.github ?? false);
  if (outcome.failure) {
    stopApi();
    cleanupPublicationRuntime();
  }
  return outcome;
}

type ApiMode = "ordinary" | "fake-build";

/** Replace only the API process, keeping this run's database and catalogue. */
export async function replaceApi(mode: ApiMode): Promise<void> {
  const environment = savedApiEnvironment();
  stopRecorded(pidPath);
  const until = Date.now() + 10_000;
  while (await responds()) {
    if (Date.now() >= until) {
      throw new Error("[app/tests] The previous API process did not stop.");
    }
    await setImmediate();
  }
  const outcome = await launchApi(environment, true, mode, true);
  if (outcome.failure) throw new Error(outcome.failure);
}

async function launchApi(
  environment: Record<string, string>,
  github: boolean,
  mode: ApiMode = "ordinary",
  appendLog = false,
): Promise<StartOutcome> {
  const log = appendLog
    ? openSync(apiLogPath, "a")
    : openServerLog(apiLogPath, pidPath);
  const command =
    mode === "fake-build"
      ? [
          "run",
          "--locked",
          "-p",
          "mkc-api",
          "--example",
          "fake-build-api",
          "--",
          "--control-address-file",
          buildControlAddressPath,
        ]
      : ["run", "--locked", "-p", "mkc-api", "--", "serve"];
  const child = spawn("cargo", command, {
    cwd: repositoryRoot,
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      ...environment,
      ...billingEnvironment,
      ...(github ? githubEnvironment : {}),
      RUSTC_WRAPPER: "",
      MKC_BIND: apiBind,
      MKC_API_ORIGIN: apiOrigin,
      MKC_MAILER: "log",
    },
  });
  child.unref();
  writeFileSync(pidPath, String(child.pid ?? ""));
  if (!(await waitForApi(startupLimitMs))) {
    stopRecorded(pidPath);
    return {
      failure: "The API did not start; browser tests need it listening.",
    };
  }
  return {};
}

/**
 * Stop the API this run started. The pid file goes, because it is the only
 * thing a later run could mistake for its own; the log stays, because after a
 * failed suite it is the only record of what the server actually did. The next
 * run starts by clearing it, so it always describes one run.
 */
export function stopApi(): void {
  stopRecorded(pidPath);
  stopStripeDouble();
}

/** The sign-in link the development mailer logged for one address. */
export function magicLinkFor(email: string): string | undefined {
  if (!existsSync(apiLogPath)) return undefined;
  const lines = readFileSync(apiLogPath, "utf8")
    .split("\n")
    .filter((line) => line.includes(email));
  const last = lines[lines.length - 1];
  return last ? /"link":"([^"]+)"/.exec(last)?.[1] : undefined;
}
