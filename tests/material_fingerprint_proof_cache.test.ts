import assert from "node:assert/strict";
import test from "node:test";

import { FingerprintSourceProofs } from "../dist/review/fingerprint_source_proofs.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

const style = "<style>.entry{color:red}</style>";
const region = (id: string) =>
  `<!--mokly-review-ignore:start:${id}-->${style}<!--mokly-review-ignore:end:${id}-->`;

test("same source and style inputs share indexes but different eligibility reruns occurrences", (context) => {
  const source = region("a") + region("b");
  const page = new PageAnalysis(source, "test");
  const first = page.inlineStyles(["b"]);
  const second = page.inlineStyles(["a"]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0]!.source, second[0]!.source);
  assert.notEqual(first[0]!.start, second[0]!.start);
  const proofs = new FingerprintSourceProofs(source, source);
  assert.strictEqual(
    proofs.markerOffsets("before"),
    proofs.markerOffsets("after"),
  );
  assert.strictEqual(
    proofs.styleOffsets("before", first),
    proofs.styleOffsets("after", second),
  );
  let searches = 0;
  const indexOf = String.prototype.indexOf;
  context.mock.method(
    String.prototype,
    "indexOf",
    function (this: string, needle: string, start?: number) {
      if (String(this) === source && needle === style) searches++;
      return indexOf.call(this, needle, start);
    },
  );
  assert.equal(proofs.occurrencesEligible("before", first), false);
  assert.equal(searches, 2);
  assert.equal(proofs.occurrencesEligible("after", second), false);
  assert.equal(
    searches,
    3,
    "different positions cannot reuse even a negative proof",
  );
  assert.equal(proofs.occurrencesEligible("before", first), false);
  assert.equal(searches, 3, "the identical failed proof is reusable");
  assert.equal(
    proofs.occurrencesEligible("after", page.inlineStyles([])),
    true,
  );
  assert.equal(searches, 6, "a different eligible set gets its own traversal");
});

test("style index inputs are exact and snapshotted independently of positions", () => {
  const other = style.replace("entry", "other");
  assert.equal(style.length, other.length);
  assert.equal(style.slice(-12), other.slice(-12));
  const source = style + other;
  const spans = new PageAnalysis(source, "test").inlineStyles([]);
  const proofs = new FingerprintSourceProofs(source, source);
  const input = [spans[0]!];
  const first = proofs.styleOffsets("before", input);
  input[0] = spans[1]!;
  const second = proofs.styleOffsets("after", input);
  assert.notStrictEqual(
    first,
    second,
    "equal signatures alone are not equal inputs",
  );
  assert.strictEqual(proofs.styleOffsets("after", [spans[0]!]), first);
  assert.strictEqual(proofs.styleOffsets("before", [spans[1]!]), second);
});

test("occurrence keys snapshot eligible positions instead of retaining a mutable list", (context) => {
  const source = region("a") + region("b");
  const spans = new PageAnalysis(source, "test").inlineStyles([]);
  const input = [spans[0]!];
  const proofs = new FingerprintSourceProofs(source, source);
  let searches = 0;
  const indexOf = String.prototype.indexOf;
  context.mock.method(
    String.prototype,
    "indexOf",
    function (this: string, needle: string, start?: number) {
      if (String(this) === source && needle === style) searches++;
      return indexOf.call(this, needle, start);
    },
  );
  assert.equal(proofs.occurrencesEligible("before", input), false);
  input[0] = spans[1]!;
  assert.equal(proofs.occurrencesEligible("after", input), false);
  assert.equal(searches, 3);
});

test("source proofs never cross different originals or view lifetimes", (context) => {
  const source = style + "<main>before</main>";
  const head = source.replace("before", "after");
  const beforeSpans = new PageAnalysis(source, "test").inlineStyles([]);
  const headSpans = new PageAnalysis(head, "test").inlineStyles([]);
  const proofs = new FingerprintSourceProofs(source, head);
  assert.notStrictEqual(
    proofs.markerOffsets("before"),
    proofs.markerOffsets("after"),
  );
  assert.notStrictEqual(
    proofs.styleOffsets("before", beforeSpans),
    proofs.styleOffsets("after", headSpans),
  );
  const fresh = new FingerprintSourceProofs(source, head);
  assert.notStrictEqual(
    proofs.markerOffsets("before"),
    fresh.markerOffsets("before"),
  );
  assert.notStrictEqual(
    proofs.styleOffsets("before", beforeSpans),
    fresh.styleOffsets("before", beforeSpans),
  );
  let searches = 0;
  const indexOf = String.prototype.indexOf;
  context.mock.method(
    String.prototype,
    "indexOf",
    function (this: string, needle: string, start?: number) {
      if ([source, head].includes(String(this)) && needle === style) searches++;
      return indexOf.call(this, needle, start);
    },
  );
  assert.equal(proofs.occurrencesEligible("before", beforeSpans), true);
  assert.equal(proofs.occurrencesEligible("after", headSpans), true);
  assert.equal(fresh.occurrencesEligible("before", beforeSpans), true);
  assert.equal(searches, 6);
});
