import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";

import type { LiveNotice } from "../../api/types";
import { createLiveClient } from "../../data/live-client";
import { watchBuildPolls } from "../../viewer/build-poll";

function fixture(
  t: TestContext,
  firstRead = Promise.resolve(),
  read = () => Promise.resolve(),
) {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const socket = Object.assign(new EventTarget(), { close: () => undefined });
  const live = createLiveClient({
    apiOrigin: "http://localhost:8080",
    openSocket: () => socket,
    schedule: (delay, retry) => {
      const timer = setTimeout(retry, delay);
      return () => clearTimeout(timer);
    },
    random: () => 0,
  });
  const tab = new EventTarget();
  let visible = true;
  let polls = 0;
  const polling = watchBuildPolls({
    buildId: "watched",
    follower: {
      firstRead,
      poll: () => {
        polls += 1;
        return read();
      },
    },
    visible: () => visible,
    every: (poll, interval) => {
      const timer = setInterval(poll, interval);
      return () => clearInterval(timer);
    },
    onVisibilityChange: (wake) => {
      tab.addEventListener("visibilitychange", wake);
      return () => tab.removeEventListener("visibilitychange", wake);
    },
  });
  const unsubscribe = live.subscribe("project", polling.subscription);
  t.after(() => {
    unsubscribe();
    polling.stop();
  });
  function message(data: string) {
    socket.dispatchEvent(new MessageEvent("message", { data }));
  }
  return {
    polls: () => polls,
    socket,
    notice(kind: LiveNotice["kind"], id = "watched") {
      const notice: LiveNotice = { type: "notice", kind, id, sequence: 3 };
      message(JSON.stringify(notice));
    },
    resync: () => message('{"type":"resync"}'),
    show(next: boolean) {
      visible = next;
      tab.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

test("the card polls at the socket's cadence and reads immediately on its notices and resync", async (t) => {
  const card = fixture(t);
  await Promise.resolve();
  t.mock.timers.tick(2_999);
  assert.equal(card.polls(), 0);
  t.mock.timers.tick(1);
  assert.equal(card.polls(), 1);
  await Promise.resolve();

  card.socket.dispatchEvent(new Event("open"));
  assert.equal(card.polls(), 2, "open reads again");
  await Promise.resolve();
  t.mock.timers.tick(29_999);
  assert.equal(card.polls(), 2);
  t.mock.timers.tick(1);
  assert.equal(card.polls(), 3);
  await Promise.resolve();

  card.notice("build", "another build");
  card.notice("another kind");
  assert.equal(card.polls(), 3);
  card.notice("build");
  assert.equal(card.polls(), 4);
  await Promise.resolve();
  card.notice("build-log");
  assert.equal(card.polls(), 5);
  await Promise.resolve();
  card.resync();
  assert.equal(card.polls(), 6);
  await Promise.resolve();

  card.show(false);
  card.notice("build");
  card.resync();
  t.mock.timers.tick(30_000);
  assert.equal(card.polls(), 6, "a hidden tab pauses reads");
  card.show(true);
  assert.equal(card.polls(), 7, "a visible tab reads again");
  await Promise.resolve();
  card.socket.dispatchEvent(new Event("close"));
  t.mock.timers.tick(2_999);
  assert.equal(card.polls(), 7);
  t.mock.timers.tick(1);
  assert.equal(
    card.polls(),
    8,
    "a closed socket restores the three-second poll",
  );
});

test("live refreshes wait for the current read and share one catch-up read", async (t) => {
  const first = Promise.withResolvers<void>();
  const next = Promise.withResolvers<void>();
  const card = fixture(t, first.promise, () => next.promise);
  card.socket.dispatchEvent(new Event("open"));
  card.notice("build");
  assert.equal(card.polls(), 0);
  first.resolve();
  await first.promise;
  assert.equal(card.polls(), 1);

  card.notice("build-log");
  card.resync();
  assert.equal(card.polls(), 1);
  next.resolve();
  await next.promise;
  assert.equal(card.polls(), 2);
});
