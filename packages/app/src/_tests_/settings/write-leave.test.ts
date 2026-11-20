import assert from "node:assert/strict";
import { test } from "node:test";

import { act } from "react";

import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";
import { leaveScreen, restoredPage } from "../navigation/leave-screen";
import { shellPage, tabAt, withWindowAsync } from "../page-window";

const address = "https://checkout.stripe.com/c/pay/cs_test";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("a late Stripe answer after unmount opens no page", async () => {
  const answer = Promise.withResolvers<string>();
  const subject = leaveScreen(
    () => useWrite(nothingToDo, alwaysSendable),
    shellPage(),
  );
  await withWindowAsync(subject.page, async () => {
    try {
      const write = subject.mount();
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = write.run(async () => write.leave(await answer.promise));
      });
      assert.equal(subject.current().pending, true);
      subject.unmount();

      await act(async () => {
        answer.resolve(address);
        await pending;
      });
      assert.deepEqual(subject.opened, []);
      assert.deepEqual(subject.seen, []);
    } finally {
      subject.unmount();
    }
  });
});

test("the window opens Stripe in the browser and returns its write to rest", async () => {
  const answer = Promise.withResolvers<string>();
  let finished = 0;
  const subject = leaveScreen(
    () => useWrite(() => void finished++, alwaysSendable),
    shellPage(),
  );
  await withWindowAsync(subject.page, async () => {
    try {
      const write = subject.mount();
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = write.run(async () => write.leave(await answer.promise));
      });
      assert.equal(subject.current().working, true);
      assert.deepEqual(subject.opened, []);

      await act(async () => {
        answer.resolve(address);
        await pending;
      });
      assert.deepEqual(subject.opened, [
        [address, "_blank", "noopener,noreferrer"],
      ]);
      assert.deepEqual(subject.seen, []);
      assert.equal(subject.current().pending, false);
      assert.equal(subject.current().working, false);
      assert.equal(finished, 1);
    } finally {
      subject.unmount();
    }
  });
  assert.deepEqual(subject.seen, []);
});

test("a tab leaves for Stripe and keeps its write busy until restored", async () => {
  let finished = 0;
  const subject = leaveScreen(
    () => useWrite(() => void finished++, alwaysSendable),
    tabAt(),
  );
  await withWindowAsync(subject.page, async () => {
    try {
      const write = subject.mount();
      await act(async () => write.run(async () => write.leave(address)));
      assert.deepEqual(subject.opened, []);
      assert.deepEqual(subject.seen, ["leave " + address]);
      assert.equal(subject.current().pending, true);
      assert.equal(subject.current().working, true);
      assert.equal(finished, 0);

      let repeated = 0;
      await act(async () => subject.current().run(async () => void repeated++));
      assert.equal(repeated, 0);
      await act(async () => subject.page.dispatchEvent(restoredPage()));
      assert.equal(subject.current().pending, false);
      assert.equal(subject.current().working, false);
    } finally {
      subject.unmount();
    }
  });
});
