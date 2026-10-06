import assert from "node:assert/strict";
import test from "node:test";

import { exchange, recovery, terminal, prose } from "./helpers/guides_ci.js";

test("Complete idempotency, accounting and cancellation copy stay explicit", () => {
  assert.match(
    exchange,
    /Repeating Complete for that upload returns the same status and body and never creates another publication/u,
  );
  assert.match(
    prose,
    /Repeating Complete for that upload returns its first status and body and never publishes again/u,
  );
  assert.match(exchange, /`200` means a different upload already completed/u);
  assert.match(prose, /`200` means a different upload already completed/u);
  for (const source of [exchange, prose]) {
    assert.match(source, /Plan(?:-| )archive/u);
    assert.match(source, /Uploading 0 of 1 file/u);
    assert.match(source, /empty `missing`/u);
    assert.match(source, /Publication was cancelled/u);
  }
  assert.match(exchange, /first publish to an empty receiver.*`0 unchanged`/u);
  assert.match(exchange, /entries sharing one digest each count/u);
  assert.match(exchange, /Blob PUT attempt in any round/u);
  assert.match(exchange, /marker's own byte length participates/u);
  assert.match(
    exchange,
    /The catalogue upload did not complete\. Check the endpoint and connection, then retry/u,
  );
  assert.match(
    exchange,
    /The only signal-based exception is the \[pre-installation window\]\(\.\/mokly-export-recovery\.md#pre-installation-window\)/u,
  );
  assert.match(
    exchange,
    /Outside that window, never infer cancellation from a cause chain, `AggregateError` members, error text or an already-aborted command signal/u,
  );
  assert.match(
    exchange,
    /prints every other error unchanged with that error's own category/u,
  );
  assert.match(
    terminal,
    /exchange cancellation rule.*decides whether a publish failure is a cancellation or another error/u,
  );
  assert.match(
    recovery,
    /restoring the previous export fails, `mokly publish` prints the export rollback error naming the retained backup/u,
  );
  assert.match(
    recovery,
    /lets the event loop complete one full turn that includes an I\/O poll, then checks once more/u,
  );
  assert.match(recovery, /uses no wall-clock delay/u);
  for (const phase of [
    "changed-path evidence",
    "Comparison generation",
    "Changes calculation",
    "removed-page preview",
  ])
    assert.ok(recovery.includes(phase), phase);
  assert.match(
    recovery,
    /keeps the original error object, class, fields, message and stack/u,
  );
  assert.match(recovery, /`MOKLY_DIAGNOSTIC=1`.*stack/u);
  assert.match(
    recovery,
    /hold a referenced Node handle.*esbuild startup.*status 1/u,
  );
  assert.match(
    prose,
    /could not put your previous export back.*recovery error.*folder to recover/u,
  );
});
