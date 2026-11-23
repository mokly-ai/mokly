import { fakeFrame, frameView } from "../../../tests/helpers/fake_frame.js";
import { postMessageAdapter } from "../dist/adapters/post_message_adapter.js";
import type { FrameMount } from "../dist/frame_adapter.js";

export async function mounted(usage: FrameMount["usage"] = frameView.usage) {
  const fake = fakeFrame();
  const promise = postMessageAdapter({
    frameOrigin: "https://frames.test",
  }).mount(fake.frame, { ...frameView, usage });
  fake.load();
  const nonce = fake.nonce();
  fake.send({ type: "ready" }, nonce);
  return { ...fake, mounted: await promise, sessionNonce: nonce };
}
