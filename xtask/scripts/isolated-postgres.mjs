import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

function runSql(statement, connection, environment) {
  const result = spawnSync(
    "psql",
    [
      "--dbname",
      connection,
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      statement,
    ],
    {
      env: environment,
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "Postgres database setup or cleanup failed; install psql and use a test role with CREATEDB permission.",
    );
}

async function runCommand(spec, environment, interruption) {
  const executable =
    process.platform === "win32" && spec.program === "npm"
      ? "npm.cmd"
      : spec.program;
  const child = spawn(executable, spec.args, {
    env: environment,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  const stop = () => {
    if (!child.pid) return;
    try {
      if (process.platform === "win32") child.kill(interruption.reason);
      else process.kill(-child.pid, interruption.reason);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  interruption.addEventListener("abort", stop, { once: true });
  if (interruption.aborted) stop();
  try {
    return await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
    });
  } finally {
    interruption.removeEventListener("abort", stop);
  }
}

/** Give every suite invocation a database, including concurrent runs of one suite. */
export async function runIsolatedSuite(
  suite,
  commands,
  {
    environment = process.env,
    nextId = randomUUID,
    signals = process,
    log = console.log,
    sql = runSql,
    command = runCommand,
  } = {},
) {
  assert(["cloud-rust", "cloud-app", "cloud-desktop"].includes(suite));
  const unique = nextId().replaceAll("-", "");
  assert.match(unique, /^[a-f0-9]{32}$/);
  const name = `mkc_gate_${suite.replaceAll("-", "_")}_${unique}`;
  const base =
    environment.MKC_TEST_DATABASE_URL ??
    "postgres://postgres:postgres@localhost/mkc_test";
  const connection = new URL(base);
  assert(["postgres:", "postgresql:"].includes(connection.protocol));
  connection.pathname = `/${name}`;
  const interruption = new AbortController();
  const interrupt = (signal) => () => interruption.abort(signal);
  const handlers = ["SIGINT", "SIGTERM"].map((signal) => [
    signal,
    interrupt(signal),
  ]);
  for (const [signal, handler] of handlers) signals.on(signal, handler);
  let created = false;
  try {
    sql(`CREATE DATABASE "${name}"`, base, environment);
    created = true;
    log(`[xtask/database] ${suite}: ${name}`);
    for (const spec of commands) {
      if (interruption.signal.aborted) break;
      const childEnvironment = { ...environment };
      for (const [key, value] of spec.environment) {
        if (value === null) delete childEnvironment[key];
        else childEnvironment[key] = value;
      }
      childEnvironment.MKC_TEST_DATABASE_URL = connection.toString();
      const status = await command(spec, childEnvironment, interruption.signal);
      if (interruption.signal.aborted) break;
      if (status !== 0) return status;
    }
    if (interruption.signal.aborted)
      return interruption.signal.reason === "SIGINT" ? 130 : 143;
    return 0;
  } finally {
    try {
      if (created)
        sql(`DROP DATABASE "${name}" WITH (FORCE)`, base, environment);
    } finally {
      for (const [signal, handler] of handlers)
        signals.removeListener(signal, handler);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await runIsolatedSuite(
      process.argv[2],
      JSON.parse(process.argv[3]),
    );
  } catch (error) {
    console.error(`[xtask/database] ${error.message}`);
    process.exitCode = 1;
  }
}
