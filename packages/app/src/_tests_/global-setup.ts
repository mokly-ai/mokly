import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  cleanupPublicationRuntime,
  prepareBuildApi,
  startApi,
  startCatalogue,
  stopApi,
} from "./api-server";
import { databaseSkipReason } from "./database";
import { startGitHubDouble, stopGitHubDouble } from "./github-double";

/** Record why the browser tests were skipped so every worker agrees. */
export const skipMarker = resolve(process.cwd(), ".expo/app-tests/skip.txt");

/**
 * Start the real API, the real catalogue server and the recorded GitHub once
 * for the whole browser suite. An environment that cannot host the suite skips
 * it aloud; one that could have hosted it and did not fails, so a silent green
 * run is impossible.
 *
 * The recorded GitHub comes first, because the API is configured to reach it:
 * the origins are handed to `mkc-api` at startup, so the server has to exist
 * before the one that calls it does.
 */
export default async function globalSetup(): Promise<void> {
  const skip = databaseSkipReason();
  mkdirSync(dirname(skipMarker), { recursive: true });
  writeFileSync(skipMarker, skip ?? "");
  if (skip) {
    process.stdout.write(`SKIP app browser tests: ${skip}\n`);
    return;
  }
  await prepareBuildApi();
  const github = await startGitHubDouble();
  if (github.failure) throw new Error(github.failure);
  const outcome = await startApi({ github: true });
  if (outcome.failure || outcome.skip) stopGitHubDouble();
  if (outcome.failure) throw new Error(outcome.failure);
  if (outcome.skip) {
    writeFileSync(skipMarker, outcome.skip);
    process.stdout.write(`SKIP app browser tests: ${outcome.skip}\n`);
    return;
  }
  const catalogue = await startCatalogue();
  if (catalogue.failure) {
    stopApi();
    stopGitHubDouble();
    cleanupPublicationRuntime();
    throw new Error(catalogue.failure);
  }
}
