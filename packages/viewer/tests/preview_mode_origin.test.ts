import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViewerInteractiveDescriptor } from "../src/client/interactive_capability.js";
import {
  liveFrameOrigin,
  liveFrameSource,
} from "../src/shell/live_frame_source.js";

const descriptor: ViewerInteractiveDescriptor = {
  generation: "c".repeat(32),
  port: 4174,
  state: "idle",
};

test("the Live origin is explicit or the shell host with the announced port", () => {
  const shell = { hostname: "localhost", protocol: "http:" };
  assert.equal(liveFrameOrigin(descriptor, shell), "http://localhost:4174");
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "127.0.0.1", protocol: "http:" }),
    "http://127.0.0.1:4174",
  );
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "[::1]", protocol: "http:" }),
    "http://[::1]:4174",
  );
  assert.equal(
    liveFrameOrigin(
      { ...descriptor, origin: "https://live.example.test" },
      shell,
    ),
    "https://live.example.test",
  );
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "", protocol: "file:" }),
    undefined,
  );
});

test("Live documents keep the static path, query and fragment on the Live origin", () => {
  const origin = "http://127.0.0.1:4174";
  assert.equal(
    liveFrameSource("/static/screens/home.mobile.html", origin),
    `${origin}/static/screens/home.mobile.html`,
  );
  assert.equal(
    liveFrameSource(
      "/static/components/action.variants/default.desktop.html?viewport=desktop#hero",
      origin,
    ),
    `${origin}/static/components/action.variants/default.desktop.html?viewport=desktop#hero`,
  );
  assert.equal(
    liveFrameSource(
      "http://127.0.0.1:4173/static/screens/home.desktop.html",
      origin,
    ),
    `${origin}/static/screens/home.desktop.html`,
  );
  assert.equal(
    liveFrameSource(
      `/__mokly/components/renders/${"a".repeat(48)}.${"b".repeat(64)}/view.html`,
      origin,
    ),
    undefined,
  );
});
