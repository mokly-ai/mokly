import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { catalogueOrigin } from "./origins";
import { publicationEnvironment } from "./publication-runtime";
import {
  catalogueLogPath,
  openServerLog,
  repositoryRoot,
  runtimeDirectory,
  stopRecorded,
} from "./server-process";
import type { StartOutcome } from "./server-process";

const cataloguePidPath = resolve(runtimeDirectory, "catalogue.pid");

async function catalogueResponds(): Promise<boolean> {
  try {
    const response = await fetch(catalogueOrigin + "/", {
      headers: { host: "p-00000000-0000-7000-8000-000000000000.localhost" },
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * Start the catalogue server the private-access tests exchange a grant with.
 * It serves published bytes from a per-publication host, which is a different
 * origin from the app in exactly the way production requires, so the cookie it
 * sets is a third-party cookie and the exchange is the real one.
 */
export async function startCatalogue(): Promise<StartOutcome> {
  if (await catalogueResponds()) {
    return {
      failure:
        `Another server is already listening on ${catalogueOrigin}. Stop it, ` +
        "or set MKC_CATALOGUE_PORT, so the suite runs against the catalogue " +
        "server it started itself.",
    };
  }
  const log = openServerLog(catalogueLogPath, cataloguePidPath);
  const child = spawn(
    "cargo",
    ["run", "--locked", "-p", "mkc-catalogue-server", "--", "serve"],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, ...publicationEnvironment(), RUSTC_WRAPPER: "" },
    },
  );
  child.unref();
  writeFileSync(cataloguePidPath, String(child.pid ?? ""));
  const until = Date.now() + 600_000;
  while (Date.now() < until) {
    if (await catalogueResponds()) return {};
    await new Promise((done) => setTimeout(done, 500));
  }
  stopCatalogue();
  return {
    failure: "The catalogue server did not start; private access needs it.",
  };
}

/** Stop the catalogue server this run started, by the pid it recorded. */
export function stopCatalogue(): void {
  stopRecorded(cataloguePidPath);
}
