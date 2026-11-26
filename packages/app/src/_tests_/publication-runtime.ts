import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { scratchDirectory } from "../../../../apps/_tests_/scratch.mjs";

import {
  createIsolatedDatabase,
  dropIsolatedDatabase,
  type IsolatedDatabase,
} from "./database";
import {
  appOrigin,
  catalogueBind,
  catalogueOrigin,
  catalogueSigningKey,
} from "./origins";
import { repositoryRoot, runtimeDirectory } from "./server-process";

let isolatedDatabase: IsolatedDatabase | undefined;
let blobRoot: string | undefined;
let previousTestDatabaseUrl: string | undefined;

/** The development-only preview identity exercised by the browser suite. */
export const previewSignInEmail = "preview@mokly.ai";

const [previewSignInPassword, previewSignInVerifier] = readFileSync(
  join(repositoryRoot, "infra/tests/fixtures/preview-verifier.txt"),
  "utf8",
)
  .trimEnd()
  .split("\n");

export { previewSignInPassword };

/** What the API and catalogue server must share for one isolated test run. */
export function publicationEnvironment(): Record<string, string> {
  if (!isolatedDatabase || !blobRoot) {
    throw new Error("The browser-suite publication runtime is not prepared.");
  }
  return {
    MKC_ENV: "development",
    MKC_DESKTOP_CLIENT: "true",
    MKC_DATABASE_URL: isolatedDatabase.url,
    MKC_APP_ORIGIN: appOrigin,
    MKC_CATALOGUE_ORIGIN: catalogueOrigin,
    MKC_CATALOGUE_BIND: catalogueBind,
    MKC_CATALOGUE_SIGNING_KEY: catalogueSigningKey,
    MKC_FILE_STORE: "local",
    MKC_FILE_STORE_ROOT: blobRoot,
    MKC_PREVIEW_SIGN_IN_EMAIL: previewSignInEmail,
    MKC_PREVIEW_SIGN_IN_VERIFIER: previewSignInVerifier,
  };
}

export function preparePublicationRuntime(): void {
  isolatedDatabase = createIsolatedDatabase();
  try {
    blobRoot = scratchDirectory(join(runtimeDirectory, "blobs-"));
    previousTestDatabaseUrl = process.env.MKC_TEST_DATABASE_URL;
    process.env.MKC_TEST_DATABASE_URL = isolatedDatabase.url;
  } catch (error) {
    dropIsolatedDatabase(isolatedDatabase);
    isolatedDatabase = undefined;
    throw error;
  }
}

/** Remove the blob directory and schema created for this browser-suite run. */
export function cleanupPublicationRuntime(): void {
  const database = isolatedDatabase;
  const root = blobRoot;
  isolatedDatabase = undefined;
  blobRoot = undefined;
  const previous = previousTestDatabaseUrl;
  previousTestDatabaseUrl = undefined;
  try {
    if (root) rmSync(root, { force: true, recursive: true });
  } finally {
    try {
      if (database) dropIsolatedDatabase(database);
    } finally {
      if (previous === undefined) delete process.env.MKC_TEST_DATABASE_URL;
      else process.env.MKC_TEST_DATABASE_URL = previous;
    }
  }
}
