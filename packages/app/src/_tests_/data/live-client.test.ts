import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";

import type { LiveNotice } from "../../api/types";
import { createLiveClient } from "../../data/live-client";
import type { LiveState } from "../../data/live-client";

class Socket extends EventTarget {
  closes = 0;

  constructor(readonly url: URL) {
    super();
  }

  open() {
    this.dispatchEvent(new Event("open"));
  }

  message(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  fail() {
    this.dispatchEvent(new Event("error"));
    this.serverClose(1006);
  }

  serverClose(code: number) {
    this.dispatchEvent(Object.assign(new Event("close"), { code }));
  }

  close() {
    this.closes += 1;
    this.serverClose(1000);
  }
}

function fixture(t: TestContext, apiOrigin: string, failFirst = false) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sockets: Socket[] = [];
  const attempts: string[] = [];
  const delays: number[] = [];
  const client = createLiveClient({
    apiOrigin,
    openSocket: (url) => {
      attempts.push(url.href);
      if (failFirst && attempts.length === 1) throw new Error("open failed");
      const socket = new Socket(url);
      sockets.push(socket);
      return socket;
    },
    schedule: (delay, retry) => {
      delays.push(delay);
      const timer = setTimeout(retry, delay);
      return () => clearTimeout(timer);
    },
    random: () => 0.5,
  });
  return { client, sockets, attempts, delays };
}

test("project subscribers share a socket and receive their notice kinds and resync", (t) => {
  const { client, sockets } = fixture(t, "https://api.example");
  const states: LiveState[] = [];
  const signals: string[] = [];
  const builds: LiveNotice[] = [];
  const stop = client.subscribe("first", {
    kinds: ["build"],
    onNotice: (notice) => builds.push(notice),
    onResync: () => signals.push("resync"),
    onState: (state) => states.push(state),
  });
  const logs: LiveNotice[] = [];
  const stopLog = client.subscribe("first", {
    kinds: ["build-log"],
    onNotice: (notice) => logs.push(notice),
  });
  const stopOther = client.subscribe("other", {
    onResync: () => signals.push("other resync"),
  });
  assert.deepEqual(
    sockets.map(({ url }) => url.href),
    [
      "wss://api.example/v1/live/projects/first",
      "wss://api.example/v1/live/projects/other",
    ],
  );
  assert.deepEqual(states, ["down"]);
  sockets[0].open();
  assert.deepEqual(states, ["down", "up"]);
  assert.deepEqual(signals, ["resync"]);
  const notice: LiveNotice = {
    type: "notice",
    kind: "build",
    id: "build-a",
    sequence: 3,
  };
  const logNotice = { ...notice, kind: "build-log" };
  sockets[0].message(JSON.stringify(notice));
  sockets[0].message(JSON.stringify(logNotice));
  sockets[0].message('{"type":"notice","kind":"build"}');
  sockets[0].message('{"type":"future"}');
  sockets[0].message("broken JSON");
  sockets[0].message(new ArrayBuffer(0));
  sockets[0].message('{"type":"resync"}');
  assert.deepEqual(builds, [notice]);
  assert.deepEqual(logs, [logNotice]);
  assert.deepEqual(signals, ["resync", "resync"]);

  const lateStates: LiveState[] = [];
  const stopLate = client.subscribe("first", {
    onState: (state) => lateStates.push(state),
  });
  assert.deepEqual(lateStates, ["up"]);
  stop();
  stopLate();
  assert.equal(sockets[0].closes, 0);
  stopLog();
  assert.equal(sockets[0].closes, 1);
  assert.equal(sockets[1].closes, 0);
  stopOther();
});

test("failed opens and server closes reconnect with capped jitter and reset on open", (t) => {
  const { client, sockets, attempts, delays } = fixture(
    t,
    "http://localhost:8080",
    true,
  );
  const states: LiveState[] = [];
  const stop = client.subscribe("project", {
    onState: (state) => states.push(state),
  });
  assert.deepEqual(attempts, ["ws://localhost:8080/v1/live/projects/project"]);
  for (const delay of [450, 900, 1_800, 3_600, 7_200, 13_500, 13_500]) {
    const count = attempts.length;
    assert.equal(delays.at(-1), delay);
    t.mock.timers.tick(delay - 1);
    assert.equal(attempts.length, count);
    t.mock.timers.tick(1);
    assert.equal(attempts.length, count + 1);
    sockets[sockets.length - 1].fail();
  }
  assert.deepEqual(states, ["down"]);
  assert.deepEqual(
    delays,
    [450, 900, 1_800, 3_600, 7_200, 13_500, 13_500, 13_500],
  );
  t.mock.timers.tick(13_500);
  sockets[sockets.length - 1].open();
  for (const code of [4403, 1001, 4408]) {
    const count = attempts.length;
    sockets[sockets.length - 1].serverClose(code);
    assert.equal(states.at(-1), "down");
    assert.equal(delays.at(-1), 450);
    t.mock.timers.tick(450);
    assert.equal(attempts.length, count + 1);
    sockets[sockets.length - 1].open();
    assert.equal(states.at(-1), "up");
  }
  stop();
});

test("leaving a project cancels its retry and ignores events from its old socket", (t) => {
  const { client, sockets, attempts } = fixture(t, "https://api.example");
  const signals: string[] = [];
  const leave = client.subscribe("first", {
    onResync: () => signals.push("first"),
  });
  assert.equal(sockets.length, 1);
  sockets[0].serverClose(1006);
  leave();
  const leaveOther = client.subscribe("other", {
    onResync: () => signals.push("other"),
  });
  sockets[0].open();
  sockets[0].message('{"type":"resync"}');
  sockets[1].open();
  t.mock.timers.tick(450);
  assert.deepEqual(signals, ["other"]);
  assert.equal(attempts.length, 2);
  leaveOther();
});
