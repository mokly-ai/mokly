import assert from "node:assert/strict";
import test from "node:test";

import { decodeAccessMessage } from "../src/access/channel.js";

const envelope = { channel: "mokly-frame-access", version: 1 };
const token = {
  ...envelope,
  type: "token",
  token: "Ab0._~+/-==",
  expiresAt: 1,
};

test("the access channel reads each message and accepts its byte and token limits", () => {
  for (const type of ["request", "reload", "unavailable"])
    assert.deepEqual(
      decodeAccessMessage(JSON.stringify({ ...envelope, type })),
      {
        type,
      },
    );
  assert.deepEqual(decodeAccessMessage(JSON.stringify(token)), {
    type: "token",
    token: "Ab0._~+/-==",
    expiresAt: 1,
  });
  const largest = {
    ...token,
    token: "A".repeat(4096),
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
  assert.deepEqual(decodeAccessMessage(JSON.stringify(largest).padEnd(8192)), {
    type: "token",
    token: largest.token,
    expiresAt: Number.MAX_SAFE_INTEGER,
  });
});

test("the access channel rejects non-strings and oversized messages before parsing", (context) => {
  const parse = context.mock.method(JSON, "parse");
  for (const [label, data] of [
    ["non-string", token],
    ["oversized", JSON.stringify(token).padEnd(8193)],
    [
      "oversized in UTF-8",
      JSON.stringify({ ...token, token: "\u20ac".repeat(3000) }),
    ],
  ] as const)
    assert.equal(decodeAccessMessage(data), undefined, label);
  assert.equal(parse.mock.callCount(), 0);
});

test("the access channel ignores malformed strings and invalid envelopes", () => {
  for (const [label, data] of [
    ["bad JSON", "{"],
    ["unknown key", JSON.stringify({ ...token, extra: true })],
    [
      "field on a request",
      JSON.stringify({ ...envelope, type: "request", expiresAt: 1 }),
    ],
    [
      "other channel",
      JSON.stringify({ ...token, channel: "mokly-frame-probe" }),
    ],
    ["other version", JSON.stringify({ ...token, version: 2 })],
    ["unknown type", JSON.stringify({ ...envelope, type: "unknown" })],
    ...["", "=", "A=b", "has space", "A\n", "A".repeat(4097)].map((value) => [
      `invalid token ${JSON.stringify(value.slice(0, 16))}`,
      JSON.stringify({ ...token, token: value }),
    ]),
    ...[undefined, "1", 0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(
      (value) => [
        `invalid expiresAt ${String(value)}`,
        JSON.stringify({ ...token, expiresAt: value }),
      ],
    ),
  ] as const) {
    assert.equal(decodeAccessMessage(data), undefined, String(label));
  }
});
