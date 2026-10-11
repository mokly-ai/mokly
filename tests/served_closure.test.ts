import assert from "node:assert/strict";
import test from "node:test";

import { ServedClosure } from "../dist/server/served_closure.js";

function members(closure: ServedClosure): string[] {
  return [...closure.current].sort();
}

test("served closure keeps checked files when a new generation drops its visits", () => {
  const closure = new ServedClosure(["guide.html", "spec.pdf"]);
  closure.visit(["diagram.svg", "spec.pdf"]);
  assert.deepEqual(members(closure), ["diagram.svg", "guide.html", "spec.pdf"]);
  closure.advance();
  assert.deepEqual(members(closure), ["guide.html", "spec.pdf"]);
});

test("only a checked result replaces the checked closure", () => {
  const closure = new ServedClosure();
  assert.deepEqual(members(closure), []);
  closure.visit(["diagram.svg"]);
  closure.accept(["guide.html"]);
  assert.deepEqual(members(closure), ["diagram.svg", "guide.html"]);
  closure.advance(["spec.pdf"]);
  assert.deepEqual(members(closure), ["spec.pdf"]);
  closure.accept([]);
  assert.deepEqual(members(closure), []);
});
