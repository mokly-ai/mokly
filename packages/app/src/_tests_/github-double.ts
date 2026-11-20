import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { appOrigin, githubBind, githubOrigin } from "./origins";
import {
  openServerLog,
  repositoryRoot,
  runtimeDirectory,
  stopRecorded,
} from "./server-process";
import type { StartOutcome } from "./server-process";

/** Where the recorded GitHub writes its log, beside the API's. */
export const githubLogPath = resolve(runtimeDirectory, "github.log");
const githubPidPath = resolve(runtimeDirectory, "github.pid");

/** The fixture App the recordings were captured for. */
const app = {
  id: "123",
  clientId: "Iv1.fixture",
  clientSecret: "fixture-client-secret",
};

/**
 * The App the API is configured with while the recorded GitHub runs. The
 * double checks the client credentials and the redirect target the token
 * exchange presents, so the suite configures the API with exactly the App its
 * answers describe — the same fixture the Rust integration harness starts it
 * with.
 */
export const githubEnvironment = {
  MKC_GITHUB_API_ORIGIN: githubOrigin,
  MKC_GITHUB_WEB_ORIGIN: githubOrigin,
  MKC_GITHUB_APP_ID: app.id,
  MKC_GITHUB_CLIENT_ID: app.clientId,
  MKC_GITHUB_CLIENT_SECRET: app.clientSecret,
  MKC_GITHUB_APP_SLUG: "mokly-test",
  MKC_GITHUB_PRIVATE_KEY: readFileSync(
    resolve(repositoryRoot, "crates/mkc-github/fixtures/test-key.pem"),
    "utf8",
  ),
  MKC_GITHUB_WEBHOOK_SECRET: "fixture-webhook-secret-with-32-bytes",
};

async function githubResponds(): Promise<boolean> {
  try {
    // Any answer proves the listener is up: the double refuses a request
    // missing the provider's own headers, and a refusal is an answer.
    const response = await fetch(githubOrigin + "/user");
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * Start the recorded GitHub the suite installs through. It answers the same
 * captured responses the API's integration tests replay, so pressing Install
 * on GitHub runs the real setup and authorization exchange — the API mints an
 * installation token, reads the installation and its repositories, and binds
 * them — rather than a routed answer standing in for one. It starts before
 * the API, because the API is configured to reach it.
 */
export async function startGitHubDouble(): Promise<StartOutcome> {
  if (await githubResponds()) {
    return {
      failure:
        `Another server is already listening on ${githubOrigin}. Stop it, or ` +
        "set MKC_GITHUB_PORT, so the suite runs against the recorded GitHub " +
        "it started itself.",
    };
  }
  const log = openServerLog(githubLogPath, githubPidPath);
  const child = spawn(
    "cargo",
    [
      "run",
      "--locked",
      "-p",
      "mkc-github-double",
      "--",
      "serve",
      "--second-installation",
      "--bind",
      githubBind,
      "--app-origin",
      appOrigin,
      "--app-id",
      app.id,
      "--client-id",
      app.clientId,
      "--client-secret",
      app.clientSecret,
    ],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, RUSTC_WRAPPER: "" },
    },
  );
  child.unref();
  writeFileSync(githubPidPath, String(child.pid ?? ""));
  const until = Date.now() + 600_000;
  while (Date.now() < until) {
    if (await githubResponds()) return {};
    await new Promise((done) => setTimeout(done, 500));
  }
  return {
    failure: "The recorded GitHub did not start; installing needs it.",
  };
}

/** Stop the recorded GitHub this run started, by the pid it recorded. */
export function stopGitHubDouble(): void {
  stopRecorded(githubPidPath);
}
