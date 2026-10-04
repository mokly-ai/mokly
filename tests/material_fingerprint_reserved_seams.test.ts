import assert from "node:assert/strict";
import test from "node:test";

import type { MaterialPiece } from "../dist/components/material_recipe.js";
import { fingerprintAtSeam } from "../dist/review/fingerprint_seams.js";

const insert = (text: string): MaterialPiece => ({
  kind: "insert",
  text,
  references: [],
  verbatim: true,
});
const piece = (start: number, end: number): MaterialPiece => ({
  kind: "source",
  start,
  end,
});

test("reserved prefixes newly cross removal/copy/insert seams", () => {
  for (const marker of [
    "<!--mokly-review-ignore:start:x-->",
    "<!--mokly-component:start:r-1-->",
  ])
    for (let cut = 1; cut < "<!--mokly-".length; cut++) {
      const source = marker.slice(0, cut) + "|" + marker.slice(cut);
      assert.equal(
        fingerprintAtSeam(source, [
          piece(0, cut),
          piece(cut + 1, source.length),
        ]),
        true,
        `${marker}/${cut}`,
      );
      assert.equal(
        fingerprintAtSeam("", [
          insert(marker.slice(0, cut)),
          insert(marker.slice(cut)),
        ]),
        true,
      );
    }
});

test("seams completing an already-open reserved marker fall back even far from its opener", () => {
  for (const opener of ["<!--mokly-review-", "<!--mokly-component:"])
    for (const size of [32, 65536]) {
      const before = opener + "x".repeat(size);
      const source = before + "|suffix-->";
      assert.equal(
        fingerprintAtSeam(source, [
          piece(0, before.length),
          piece(before.length + 1, source.length),
        ]),
        true,
      );
      assert.equal(
        fingerprintAtSeam(source, [piece(0, before.length), insert("-->")]),
        true,
      );
      assert.equal(
        fingerprintAtSeam(source, [
          insert(before),
          piece(before.length + 1, source.length),
        ]),
        true,
      );
    }
});

test("complete kept markers, owned comments and placeholders do not create reserved seams", () => {
  for (const marker of [
    "<!--mokly-owned:action:k1-->",
    "<!--mokly-review-ignore:x-->",
    "<!--mokly-component:start:r-1-->",
    "<!--mokly-inline-style:D-->",
  ]) {
    assert.equal(
      fingerprintAtSeam("body", [insert(marker), piece(0, 4)]),
      false,
      marker,
    );
    assert.equal(
      fingerprintAtSeam("body", [piece(0, 4), insert(marker)]),
      false,
      marker,
    );
  }
  const source = "<!--mokly-review-other:closed-->tail";
  assert.equal(
    fingerprintAtSeam(source, [
      piece(0, source.length - 4),
      insert("new tail"),
    ]),
    false,
  );
});

test("a seam can finish the opener name after an already-kept reserved prefix", () => {
  for (const opener of ["<!--mokly-review-", "<!--mokly-component:"])
    for (let cut = "<!--mokly-".length; cut < opener.length; cut++) {
      const source =
        opener.slice(0, cut) + "|" + opener.slice(cut) + "other-->";
      assert.equal(
        fingerprintAtSeam(source, [
          piece(0, cut),
          piece(cut + 1, source.length),
        ]),
        true,
        `${opener}/${cut}`,
      );
      assert.equal(
        fingerprintAtSeam("", [
          insert(opener.slice(0, cut)),
          insert(opener.slice(cut) + "other-->"),
        ]),
        true,
      );
    }
});
