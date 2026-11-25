/** The start order and the shutdown rules of `npm run dev:cloud`. */
import assert from "node:assert/strict";
import test from "node:test";

import { runStack } from "./dev-stack.mjs";

const origins = {
  database: { host: "localhost", port: 5432 },
  apiHealth: "http://api.test/health",
  catalogueHealth: "http://catalogue.test/health",
  app: "http://app.test",
};

/**
 * A stack whose every process and probe is recorded in `events`. Each URL in
 * `readyAfter` answers from the given probe on, counted from 1. A service
 * named in `exits` exits on its own with that status when it starts. With
 * `interrupt`, the user stops the stack once it reports that it runs.
 */
function fakeStack({
  postgres = true,
  failing = "",
  readyAfter = {},
  exits = {},
  interrupt = false,
} = {}) {
  const events = [];
  const probes = new Map();
  /** @type {() => void} */
  let interruptNow = () => {};
  const interrupted = new Promise((resolve) => (interruptNow = resolve));
  const deps = {
    origins,
    prepare: async () => void events.push("prepare"),
    listening: async () => postgres,
    run: async (command, args) => {
      const line = [command, ...args].join(" ");
      events.push(`run ${line}`);
      return line === failing ? 1 : 0;
    },
    start: (name) => {
      events.push(`start ${name}`);
      let exit = () => {};
      const exited = new Promise((resolve) => (exit = resolve));
      if (name in exits) exit(exits[name]);
      return {
        name,
        exited,
        stop: async () => {
          events.push(`stop ${name}`);
          exit(null);
        },
      };
    },
    answers: async (url) => {
      const count = (probes.get(url) ?? 0) + 1;
      probes.set(url, count);
      const ready = count >= (readyAfter[url] ?? 1);
      if (ready) events.push(`ready ${url}`);
      return ready;
    },
    pause: async () => {},
    interrupted,
    report: (message) => {
      events.push(`report ${message}`);
      // The user presses Ctrl+C once the stack says that it runs.
      if (interrupt && message.startsWith("Mokly Cloud runs")) interruptNow();
    },
  };
  return { deps, events };
}

test("starts the app only after the API and the catalogue answer, and stops every server on Ctrl+C", async () => {
  const { deps, events } = fakeStack({
    readyAfter: { [origins.catalogueHealth]: 3 },
    interrupt: true,
  });

  assert.equal(await runStack(deps), 0);

  assert.deepEqual(events, [
    "prepare",
    "report Using the Postgres server on localhost:5432.",
    "run cargo build --locked -p mkc-api",
    "run cargo build --locked -p mkc-catalogue-server",
    "start api",
    "start catalogue",
    "ready http://api.test/health",
    "ready http://catalogue.test/health",
    "start app",
    "ready http://app.test",
    "report Mokly Cloud runs. Open http://app.test/sign-up. The [api] log prints the sign-in link. Press Ctrl+C to stop.",
    "stop api",
    "stop catalogue",
    "stop app",
  ]);
});

test("starts Postgres with Docker when nothing answers on the database port", async () => {
  const { deps, events } = fakeStack({ postgres: false, interrupt: true });

  assert.equal(await runStack(deps), 0);

  assert.deepEqual(events.slice(1, 3), [
    "report Starting Postgres with Docker, because nothing answers on localhost:5432.",
    "run docker compose up --detach --wait postgres",
  ]);
});

test("starts no server when a preparation step fails", async () => {
  const { deps, events } = fakeStack({
    failing: "cargo build --locked -p mkc-api",
    // Ends the run, so a launcher that goes on fails the assertions, not hangs.
    interrupt: true,
  });

  assert.equal(await runStack(deps), 1);

  assert.deepEqual(events.slice(-2), [
    "run cargo build --locked -p mkc-api",
    "report npm run dev:cloud stopped, because cargo build --locked -p mkc-api failed.",
  ]);
});

test("stops the other servers and fails when a server exits before the app starts", async () => {
  const { deps, events } = fakeStack({
    readyAfter: { [origins.catalogueHealth]: Infinity },
    exits: { catalogue: 101 },
  });

  assert.equal(await runStack(deps), 1);

  assert.equal(events.includes("start app"), false);
  assert.deepEqual(events.slice(-3), [
    "report [catalogue] exited with status 101. Stopping the other servers.",
    "stop api",
    "stop catalogue",
  ]);
});
