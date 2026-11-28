/**
 * The order in which `npm run dev:cloud` starts the local Mokly Cloud stack:
 * the workspace build, Postgres, the two Rust servers, and then the app once
 * both servers answer. Every process and network call comes in through
 * `deps`, so the order and the shutdown rules run without real processes.
 */

/** The crates that `scripts/cloud/dev-api.sh` and `dev-catalogue.sh` run. */
const CRATES = ["mkc-api", "mkc-catalogue-server"];

/**
 * @typedef {object} Service
 * @property {string} name
 * @property {Promise<number | null>} exited The exit status, or null after a signal.
 * @property {() => Promise<void>} stop Stop the service and wait until it exits.
 */

/**
 * @typedef {object} StackOrigins
 * @property {{ host: string, port: number }} database
 * @property {string} apiHealth
 * @property {string} catalogueHealth
 * @property {string} app The app origin that the user opens.
 */

/**
 * @typedef {object} StackDeps
 * @property {StackOrigins} origins
 * @property {() => Promise<void>} prepare Install and build the workspace.
 * @property {(host: string, port: number) => Promise<boolean>} listening
 * @property {(command: string, args: string[]) => Promise<number>} run
 * @property {(name: string, command: string, args: string[]) => Service} start
 * @property {(url: string) => Promise<boolean>} answers
 * @property {() => Promise<void>} pause The wait between two readiness probes.
 * @property {Promise<void>} interrupted Settles when the user stops the stack.
 * @property {(message: string) => void} report
 */

/** A one-shot step failed; the message says which. */
export class StackFailure extends Error {}

/**
 * Start the stack and keep it running until a server exits or the user stops
 * it. Resolve with the process exit status: 0 after the user stops it, 1
 * after a failure.
 *
 * @param {StackDeps} deps
 * @returns {Promise<number>}
 */
export async function runStack(deps) {
  let startedPostgres = false;
  try {
    await deps.prepare();
    startedPostgres = await ensurePostgres(deps);
    for (const crate of CRATES)
      await step(deps, "cargo", ["build", "--locked", "-p", crate]);
  } catch (error) {
    if (!(error instanceof StackFailure)) throw error;
    deps.report(error.message);
    reportPostgres(deps, startedPostgres);
    return 1;
  }
  const status = await serve(deps);
  reportPostgres(deps, startedPostgres);
  return status;
}

/**
 * Use the Postgres server that answers, or start the Compose service. Resolve
 * with whether this run started it.
 */
async function ensurePostgres(deps) {
  const { host, port } = deps.origins.database;
  if (await deps.listening(host, port)) {
    deps.report(`Using the Postgres server on ${host}:${port}.`);
    return false;
  }
  deps.report(
    `Starting Postgres with Docker, because nothing answers on ${host}:${port}.`,
  );
  await step(deps, "docker", [
    "compose",
    "up",
    "--detach",
    "--wait",
    "postgres",
  ]);
  return true;
}

/** The Compose container keeps its data and its port after the stack stops. */
function reportPostgres(deps, startedPostgres) {
  if (startedPostgres)
    deps.report(
      "Postgres keeps running in Docker. Stop it with docker compose stop postgres.",
    );
}

async function step(deps, command, args) {
  if ((await deps.run(command, args)) !== 0)
    throw new StackFailure(
      `npm run dev:cloud stopped, because ${command} ${args.join(" ")} failed.`,
    );
}

/** The outcome that ends a running stack. */
const INTERRUPTED = Symbol("interrupted");

async function serve(deps) {
  /** @type {Service[]} */
  const services = [];
  let ended = false;
  /** @type {(value: { service: Service, status: number | null }) => void} */
  let markExit = () => {};
  const firstExit = new Promise((resolve) => (markExit = resolve));
  const end = Promise.race([
    firstExit,
    deps.interrupted.then(() => INTERRUPTED),
  ]).then((outcome) => {
    ended = true;
    return outcome;
  });
  const launch = (name, command, args) => {
    const service = deps.start(name, command, args);
    services.push(service);
    void service.exited.then((status) => markExit({ service, status }));
  };

  const waitUntilReady = async (url) => {
    while (!ended) {
      if (await deps.answers(url)) return;
      await deps.pause();
    }
  };

  launch("api", "scripts/cloud/dev-api.sh", []);
  launch("catalogue", "scripts/cloud/dev-catalogue.sh", []);
  const { apiHealth, catalogueHealth, app } = deps.origins;
  await Promise.race([
    Promise.all([waitUntilReady(apiHealth), waitUntilReady(catalogueHealth)]),
    end,
  ]);
  if (!ended) {
    launch("app", "npm", ["run", "start", "--workspace", "@mokly-cloud/app"]);
    await Promise.race([waitUntilReady(app), end]);
  }
  if (!ended)
    deps.report(
      `Mokly Cloud runs. Open ${app}/sign-up. The [api] log prints the sign-in link. Press Ctrl+C to stop.`,
    );

  const outcome = await end;
  if (outcome !== INTERRUPTED)
    deps.report(
      `[${outcome.service.name}] exited with status ${outcome.status}. Stopping the other servers.`,
    );
  await Promise.all(services.map((service) => service.stop()));
  return outcome === INTERRUPTED ? 0 : 1;
}
