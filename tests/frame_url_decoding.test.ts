import assert from "node:assert/strict";
import test from "node:test";

import { currentDocumentRoute } from "../packages/viewer/dist/catalogue/delivery_paths.js";
import {
  frameUrl,
  temporaryFrameUrl,
} from "../packages/viewer/dist/client/frame_mount.js";
import { postMessageAdapter } from "../packages/viewer/dist/client/post_message_adapter.js";

import { fakeFrame, frameView } from "./helpers/fake_frame.js";

const origin = "https://frames.test";
const prefix = "/static/mokly-generated/";

for (const encoded of [
  "home/index.mobile.html",
  "%68ome/index.mobile.html",
  "home/index%2emobile.html",
  "home/index.mobile%2Ehtml",
]) {
  test(`current mount decodes one accepted path layer: ${encoded}`, () => {
    const url = new URL(`${origin}${prefix}${encoded}?revision=2#%73ection`);
    assert.equal(currentDocumentRoute(url.pathname), "home/index.mobile.html");
    assert.equal(
      frameUrl(fakeFrame().frame, { ...frameView, url }, origin).href,
      url.href,
    );
  });
}

for (const encoded of [
  "%2568ome/index.mobile.html",
  "home/index%252emobile.html",
  "%2573tatic/mokly-generated/home/index.mobile.html",
]) {
  test(`current mount does not turn double encoding into an assigned route: ${encoded}`, () => {
    const pathname = encoded.startsWith("%2573tatic")
      ? `/${encoded}`
      : `${prefix}${encoded}`;
    const url = new URL(`${origin}${pathname}`);
    assert.equal(currentDocumentRoute(url.pathname), undefined);
    assert.throws(
      () => frameUrl(fakeFrame().frame, { ...frameView, url }, origin),
      { code: "origin" },
    );
  });
}

for (const pathname of [
  `${prefix}%/index.mobile.html`,
  `${prefix}%E0%A4/index.mobile.html`,
  `${prefix}home%2fother/index.mobile.html`,
  `${prefix}home%5cother/index.mobile.html`,
  `${prefix}%252e%252e/home/index.mobile.html`,
  `${prefix}%2e%2e/home/index.mobile.html`,
  `${prefix}home/../index.mobile.html`,
]) {
  test(`invalid current path stays outside route and mount boundaries: ${pathname}`, () => {
    assert.equal(currentDocumentRoute(pathname), undefined);
    const url = new URL(`${origin}${pathname}`);
    assert.throws(
      () => frameUrl(fakeFrame().frame, { ...frameView, url }, origin),
      { code: "origin" },
    );
  });
}

test("private previews retain literal percent text and their separate mount authority", () => {
  const bundle = `${"a".repeat(48)}.${"b".repeat(64)}`;
  const root = `/mokly-viewer/components/renders/${bundle}/`;
  for (const route of [
    "home/index.mobile.html",
    "%2568ome/index.mobile.html",
  ]) {
    const url = new URL(`${origin}${root}${route}?revision=2#section`);
    assert.equal(
      temporaryFrameUrl(fakeFrame().frame, { ...frameView, url }, origin).href,
      url.href,
    );
    assert.throws(
      () => frameUrl(fakeFrame().frame, { ...frameView, url }, origin),
      { code: "origin" },
    );
  }
  for (const route of [
    "home%2fother/index.html",
    "%/index.html",
    "../outside.html",
  ]) {
    const url = new URL(`${origin}${root}${route}`);
    assert.throws(
      () => temporaryFrameUrl(fakeFrame().frame, { ...frameView, url }, origin),
      { code: "origin" },
    );
  }
});

test("cross-origin encoded mounts use only assigned URL and observable message authentication", async () => {
  const fake = fakeFrame();
  let pathReads = 0;
  Object.defineProperty(fake.frame.contentWindow!.location, "pathname", {
    get() {
      pathReads++;
      throw new Error("cross-origin path is not observable");
    },
  });
  const url = new URL(
    `${origin}${prefix}%68ome/index.mobile.html?revision=2#section`,
  );
  let settled = false;
  const pending = postMessageAdapter({ frameOrigin: origin })
    .mount(fake.frame, { ...frameView, url })
    .then((mounted) => {
      settled = true;
      return mounted;
    });
  fake.load();
  const nonce = fake.nonce();
  fake.raw(
    JSON.stringify({
      channel: "mokly-inspector",
      version: 2,
      nonce,
      type: "ready",
    }),
    "https://wrong.test",
  );
  fake.send({ type: "ready" }, "f".repeat(32));
  await Promise.resolve();
  assert.equal(settled, false);
  fake.send({ type: "ready" }, nonce);
  const mounted = await pending;
  assert.equal(pathReads, 0);
  assert.equal(new URL(fake.replacements[0]!).pathname, url.pathname);
  assert.equal(new URL(fake.replacements[0]!).hash, "#section");
  assert.ok(fake.posts.every((post) => post.origin === origin));
  mounted.dispose();
});
