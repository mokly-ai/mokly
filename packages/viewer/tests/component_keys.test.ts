import assert from "node:assert/strict";
import { test } from "node:test";

import { instanceKey, slotKey } from "../src/components/keys.js";

// SHA-256 vectors for the UTF-8 JSON preimages in mokly-instances.md.
const PANEL =
  "9f32d30edac863c273252105944807701e188c931a56288b5628d6c5c29205d0";
const CHILDREN =
  "ce9baa88e30883cc9969d37f5c80e106933df8d8548362c844f0aeed7668d0a8";

test("entry-owned instance keys use the protocol domain", () => {
  assert.equal(instanceKey({ kind: "entry" }, undefined, "panel"), PANEL);
});

test("slot keys use the protocol domain and receiving instance", () => {
  assert.equal(slotKey(PANEL, "children"), CHILDREN);
  assert.equal(
    slotKey(PANEL, "trailing"),
    "84a5b8f828bd9b26e32304c0f7f7ca7a31e51a983d762010afa258a12a491eba",
  );
});

test("supplied instances keep their input owner and original slot scope", () => {
  assert.equal(
    instanceKey({ kind: "entry" }, CHILDREN, "button"),
    "6be673b9537507c714b7f53654ec6198a80551f38a1f271e579498420c40c413",
  );
  assert.equal(
    instanceKey({ kind: "instance", instanceKey: PANEL }, undefined, "button"),
    "a126075db7aff9e90b9489775c56f5e0d0d27f49f43af5649cc4fbc5ed2db999",
  );
});
