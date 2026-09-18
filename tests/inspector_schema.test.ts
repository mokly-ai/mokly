import assert from "node:assert/strict";
import test from "node:test";

import {
  validMessage,
  encodeMessage,
  type MessageBody,
} from "../packages/viewer/dist/inspector/schema.js";
import { boundedJson } from "../packages/viewer/dist/inspector/values.js";

const nonce = "1".repeat(32),
  key = "a".repeat(64);
const box = { x: -2, y: 5, width: 10, height: 0 };
const messages: MessageBody[] = [
  { type: "hello" },
  { type: "ready" },
  { type: "list", requestId: 1 },
  {
    type: "boundaries",
    requestId: 2,
    boundaries: [{ key, ranges: [{ id: "r-0", boxes: [box] }] }],
  },
  { type: "highlight", requestId: 3, keys: [key], mode: "highlight" },
  { type: "scroll-to", requestId: 4, key },
  {
    type: "subscribe",
    requestId: 5,
    events: ["hover", "click", "navigation", "pick-end", "geometry"],
  },
  { type: "ack", requestId: 6 },
  { type: "hover", key: null, boxes: [] },
  { type: "click", key, boxes: [box] },
  {
    type: "navigation",
    navigation: {
      id: "details",
      fragment: "Section:1",
      target: { kind: "named", name: "Report.1" },
      activation: "middle",
    },
  },
  { type: "pick-end", reason: "escape" },
  { type: "geometry" },
  { type: "error", requestId: null, code: "limit" },
  { type: "dispose" },
];
const wire = (body: object) => ({
  channel: "mokly-inspector",
  version: 1,
  nonce,
  ...body,
});

for (const body of messages)
  test(`inspector schema: ${body.type} accepts only its exact envelope`, () => {
    assert.ok(validMessage(boundedJson(encodeMessage(nonce, body)), nonce));
    for (const mutation of [
      { extra: true },
      { nonce: "f".repeat(32) },
      { channel: "other" },
      { version: 2 },
      { nonce: "INVALID" },
      { type: "unknown" },
    ])
      assert.equal(validMessage({ ...wire(body), ...mutation }, nonce), false);
    for (const field of Object.keys(wire(body))) {
      const value = wire(body) as Record<string, unknown>;
      delete value[field];
      assert.equal(validMessage(value, nonce), false);
    }
  });

test("inspector rejects malformed envelopes before parsing and counts UTF-8 bytes", () => {
  for (const value of [
    null,
    {},
    [],
    new Uint8Array(2),
    "{",
    " ".repeat(262145),
    `"${"é".repeat(131072)}"`,
  ])
    assert.equal(boundedJson(value), undefined);
  assert.equal(boundedJson(`"${"é".repeat(131071)}"`), "é".repeat(131071));
});

test("inspector recursively rejects unknown fields, invalid geometry and duplicate identities", () => {
  const boundaries = (value: unknown) =>
    validMessage(wire({ type: "boundaries", requestId: 1, boundaries: value }));
  const item = { key, ranges: [{ id: "r-0", boxes: [box] }] };
  assert.ok(boundaries([item]));
  for (const invalid of [
    [{ ...item, html: "text" }],
    [{ ...item, ranges: [{ ...item.ranges[0], selector: "div" }] }],
    [{ ...item, ranges: [{ id: "r-0", boxes: [{ ...box, text: "secret" }] }] }],
    [item, item],
    [{ ...item, ranges: [item.ranges[0], item.ranges[0]] }],
    [{ ...item, ranges: [{ id: `r-${"1".repeat(15)}`, boxes: [] }] }],
  ])
    assert.equal(boundaries(invalid), false);
  for (const field of ["x", "y", "width", "height"])
    for (const number of [
      NaN,
      Infinity,
      -Infinity,
      1000001,
      "1",
      null,
      ...(field === "width" || field === "height" ? [-1] : [-1000001]),
    ])
      assert.equal(
        boundaries([
          {
            ...item,
            ranges: [{ id: "r-0", boxes: [{ ...box, [field]: number }] }],
          },
        ]),
        false,
      );
  assert.equal(
    boundaries([
      { ...item, ranges: [{ id: "r-0", boxes: Array(65).fill(box) }] },
    ]),
    false,
  );
  assert.equal(
    validMessage(wire({ type: "hover", key: null, boxes: [box] })),
    false,
  );
});

test("inspector enforces key/range/box totals without truncation", () => {
  const keys = Array.from({ length: 1025 }, (_, index) =>
    index.toString(16).padStart(64, "0"),
  );
  const boundaries = keys.map((key) => ({ key, ranges: [] }));
  const valid = (items: unknown) =>
    validMessage(wire({ type: "boundaries", requestId: 1, boundaries: items }));
  assert.ok(valid(boundaries.slice(0, 1024)));
  assert.equal(valid(boundaries), false);
  const ranges = Array.from({ length: 4097 }, (_, index) => ({
    id: `r-${index}`,
    boxes: [],
  }));
  assert.ok(valid([{ key, ranges: ranges.slice(0, 4096) }]));
  assert.equal(valid([{ key, ranges }]), false);
  const many = Array.from({ length: 129 }, (_, index) => ({
    id: `r-${index}`,
    boxes: Array(64).fill(box),
  }));
  assert.ok(valid([{ key, ranges: many.slice(0, 128) }]));
  assert.equal(valid([{ key, ranges: many }]), false);
  for (const invalid of [
    { keys: [key, key], mode: "pick" },
    { keys: [key], mode: "off" },
    { keys, mode: "highlight" },
  ])
    assert.equal(
      validMessage(wire({ type: "highlight", requestId: 1, ...invalid })),
      false,
    );
  for (const requestId of [0, -1, 0.5, "1", Number.MAX_SAFE_INTEGER + 1])
    assert.equal(validMessage(wire({ type: "list", requestId })), false);
  assert.equal(
    validMessage(
      wire({ type: "subscribe", requestId: 1, events: ["hover", "hover"] }),
    ),
    false,
  );
});

test("navigation permits bounded logical metadata only", () => {
  const base = {
    id: "screen",
    target: { kind: "self" },
    activation: "primary",
  };
  for (const mutation of [
    { id: "a".repeat(257) },
    { fragment: "#section" },
    { fragment: "a".repeat(257) },
    { target: { kind: "self", name: "other" } },
    { target: { kind: "named", name: " invalid" } },
    { target: { kind: "named", name: "a".repeat(257) } },
    { href: "/static/home.html" },
    { activation: "contextmenu" },
  ])
    assert.equal(
      validMessage(
        wire({ type: "navigation", navigation: { ...base, ...mutation } }),
      ),
      false,
    );
  for (const kind of ["self", "top", "parent", "blank"])
    assert.ok(
      validMessage(
        wire({ type: "navigation", navigation: { ...base, target: { kind } } }),
      ),
    );
});
