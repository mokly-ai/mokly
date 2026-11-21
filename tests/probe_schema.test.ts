import assert from "node:assert/strict";
import test from "node:test";

import {
  validMessage,
  encodeMessage,
  type MessageBody,
} from "../packages/frame/dist/probe/schema.js";
import { boundedJson } from "../packages/frame/dist/probe/values.js";

const nonce = "1".repeat(32),
  key = "a".repeat(64);
const box = { x: -2, y: 5, width: 10, height: 0 };
const model = {
  box,
  border: { top: 2, right: 2, bottom: 2, left: 2 },
  padding: { top: 6, right: 12, bottom: 6, left: 12 },
};
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
  { type: "measure", requestId: 7, key },
  { type: "box-model", requestId: 7, boxModel: model },
  { type: "box-model", requestId: 8, boxModel: null },
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
      screenPath: "details",
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
  channel: "mokly-frame-probe",
  version: 4,
  nonce,
  ...body,
});

for (const body of messages) {
  const name =
    body.type === "box-model" && body.boxModel === null
      ? "box-model null"
      : body.type;
  test(`probe schema: ${name} accepts only its exact envelope`, () => {
    assert.ok(validMessage(boundedJson(encodeMessage(nonce, body)), nonce));
    for (const mutation of [
      { extra: true },
      { nonce: "f".repeat(32) },
      { channel: "other" },
      { version: 3 },
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
}

test("probe rejects malformed envelopes before parsing and counts UTF-8 bytes", () => {
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

test("box-model rejects unknown fields, missing sides and invalid numeric bounds", () => {
  for (const boxModel of [
    { ...model, extra: 1 },
    { ...model, box: { ...box, extra: 1 } },
    { ...model, border: { ...model.border, extra: 1 } },
    { ...model, padding: { ...model.padding, extra: 1 } },
    { ...model, border: { top: 2, right: 2, bottom: 2 } },
    { ...model, padding: { top: 6, right: 12, bottom: 6 } },
    { ...model, border: { ...model.border, top: -1 } },
    { ...model, padding: { ...model.padding, left: 1000001 } },
    { ...model, box: { ...box, width: -1 } },
    { ...model, box: { ...box, x: -1000001 } },
    { ...model, padding: { ...model.padding, top: "6" } },
    { ...model, border: { ...model.border, right: NaN } },
    { ...model, border: { ...model.border, bottom: Infinity } },
  ])
    assert.equal(
      validMessage(wire({ type: "box-model", requestId: 1, boxModel })),
      false,
      JSON.stringify(boxModel),
    );
});

test("probe recursively rejects unknown fields, invalid geometry and duplicate identities", () => {
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

test("probe enforces key/range/box totals without truncation", () => {
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
    screenPath: "screen",
    target: { kind: "self" },
    activation: "primary",
  };
  for (const mutation of [
    { screenPath: "a".repeat(257) },
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
