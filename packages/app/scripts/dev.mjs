/**
 * `npm run dev:cloud`: start the local Mokly Cloud stack with one command.
 * `dev-stack.mjs` holds the order and the shutdown rules.
 */
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { prepareDevelopment } from "../../../scripts/dev-preparation.mjs";

import {
  answers,
  interruption,
  listening,
  runCommand,
  startService,
} from "./dev-processes.mjs";
import { DEFAULT_DATABASE_URL, databaseEndpoint } from "./dev-settings.mjs";
import { runStack } from "./dev-stack.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const options = { cwd: repositoryRoot, env: process.env };
const run = (command, args) => runCommand(command, args, options);
const report = (message) => console.error(message);

// The defaults match `scripts/cloud/dev-publication-env.sh` and `dev-api.sh`.
const apiOrigin = process.env.MKC_API_ORIGIN ?? "http://localhost:8080";
const catalogueBind = process.env.MKC_CATALOGUE_BIND ?? "127.0.0.1:8082";
const appOrigin = `http://localhost:${process.env.MKC_APP_PORT ?? 8081}`;

/**
 * Install when needed, then always build: the build is incremental, and the
 * app serves the built workspace packages, so a source change must reach them.
 * `prepareDevelopment` already builds a checkout that has no build output.
 */
async function prepare() {
  let built = false;
  await prepareDevelopment(repositoryRoot, {
    run: (args) => {
      if (args[0] === "run" && args[1] === "build") built = true;
      return run("npm", [...args]);
    },
    report,
  });
  if (built) return;
  report("Building with npm run build.");
  if ((await run("npm", ["run", "build"])) !== 0)
    throw new Error("npm run dev:cloud stopped, because npm run build failed.");
}

let status = 1;
try {
  status = await runStack({
    origins: {
      database: databaseEndpoint(
        process.env.MKC_DATABASE_URL ?? DEFAULT_DATABASE_URL,
      ),
      apiHealth: `${apiOrigin}/v1/health`,
      catalogueHealth: `http://${catalogueBind}/_health`,
      app: appOrigin,
    },
    prepare,
    listening,
    run,
    start: (name, command, args) => startService(name, command, args, options),
    answers,
    pause: () => delay(500),
    interrupted: interruption(),
    report,
  });
} catch (error) {
  report(error instanceof Error ? error.message : String(error));
}
// Exit at once: a process that escaped its group can still hold an output
// pipe, and it must not keep the launcher open after its servers stopped.
process.exit(status);
