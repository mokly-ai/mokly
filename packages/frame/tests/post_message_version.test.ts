import assert from "node:assert/strict";
import test from "node:test";

import { fakeFrame, frameView } from "../../../tests/helpers/fake_frame.js";
import { postMessageAdapter } from "../dist/adapters/post_message_adapter.js";

/** A message of the version 3 probe that Mokly 0.21.0 embeds in its pages. */
const earlier = (nonce: string, type: string) =>
  JSON.stringify({ channel: "mokly-frame-probe", version: 3, nonce, type });

function mount() {
  const fake = fakeFrame();
  const promise = postMessageAdapter({
    frameOrigin: "https://frames.test",
  }).mount(fake.frame, frameView);
  fake.load();
  return { fake, promise, nonce: fake.nonce() };
}

test("a page whose probe answers only the version 3 handshake rejects the mount as outdated", async () => {
  const { fake, promise, nonce } = mount();
  assert.deepEqual(
    fake.posts.map(({ data, origin }) => [JSON.parse(data), origin]),
    [
      [
        { channel: "mokly-frame-probe", version: 4, nonce, type: "hello" },
        "https://frames.test",
      ],
      [
        { channel: "mokly-frame-probe", version: 3, nonce, type: "hello" },
        "https://frames.test",
      ],
    ],
  );
  fake.raw(earlier(nonce, "ready"));
  await assert.rejects(promise, { code: "version" });
  assert.equal(fake.timers.size, 0);
});

test("a version 3 reply from another origin or for another mount leaves the mount waiting", async () => {
  const { fake, promise, nonce } = mount();
  fake.raw(earlier(nonce, "ready"), "https://other.test");
  fake.raw(earlier("0".repeat(32), "ready"));
  fake.raw(earlier(nonce, "geometry"));
  fake.send({ type: "ready" }, nonce);
  const mounted = await promise;
  fake.raw(earlier(nonce, "ready"));
  const cleared = mounted.highlight([], "off");
  const { requestId } = JSON.parse(fake.posts.at(-1)!.data) as {
    requestId: number;
  };
  fake.send({ type: "ack", requestId }, nonce);
  await cleared;
  mounted.dispose();
});
