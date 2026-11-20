import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  defaultDestination,
  transportReturnTo,
  validateReturnTo,
} from "../navigation/return-to";

interface ReturnToFixture {
  accepted: { input: string; output: string }[];
  rejected: (string | null)[];
}

const fixturePath = path.resolve(
  import.meta.dirname,
  "../../../../crates/mkc-domain/src/_tests_/fixtures/return_to_cases.json",
);

test("Rust and TypeScript share accepted and rejected return destinations", async () => {
  const fixture = JSON.parse(
    await readFile(fixturePath, "utf8"),
  ) as ReturnToFixture;
  for (const { input, output } of fixture.accepted) {
    assert.equal(validateReturnTo(input), output, input);
  }
  for (const input of fixture.rejected) {
    assert.equal(validateReturnTo(input), defaultDestination, String(input));
  }
});

test("an undefined destination becomes the application root", () => {
  assert.equal(validateReturnTo(undefined), defaultDestination);
});

test("sign-in preserves the destination query after outer decoding", () => {
  const destination =
    "/acme/website/branches?branch=review%26docs+literal%2Bplus%23notes" +
    "&label=日本語&tag=first&tag=second";
  const signIn = new URL(
    `/sign-in?returnTo=${encodeURIComponent(destination)}`,
    "https://app.test",
  );

  const held = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: { location: { search: signIn.search } },
    configurable: true,
  });
  try {
    const transported = transportReturnTo(
      "/connect?selection=one&docs+literal+plus",
      signIn.search,
    );
    assert.equal(transported, destination);
    assert.equal(validateReturnTo(transported), destination);
    assert.equal(transportReturnTo("/acme/website", ""), null);
  } finally {
    if (held) Object.defineProperty(globalThis, "window", held);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("native and server entry retain the router-provided destination", () => {
  assert.equal(transportReturnTo("/acme/website"), "/acme/website");
  assert.equal(transportReturnTo("/acme/website", ""), "/acme/website");
});

test("a native window without browser location retains the router value", () => {
  const held = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  try {
    assert.equal(transportReturnTo("/acme/website"), "/acme/website");
    assert.equal(transportReturnTo("/acme/website", ""), "/acme/website");
  } finally {
    if (held) Object.defineProperty(globalThis, "window", held);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
