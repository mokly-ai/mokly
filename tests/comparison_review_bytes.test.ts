/**
 * One comparison writes the same compact `review.json` in a static build and
 * in Serve, while the entry details of its generation keep two-space JSON.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { completed, serve } from "./helpers/mokly_serve.js";
import { build, fixture } from "./helpers/static_changes.js";

/** One final LF and no whitespace outside JSON strings. */
function assertCompact(text: string) {
  assert.ok(text.endsWith("}\n"), text.slice(-40));
  let quoted = false;
  for (let index = 0; index < text.length - 1; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === "\\") index += 1;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else assert.ok(!/\s/u.test(character), `whitespace at offset ${index}`);
  }
}

/** Every object lists its keys in UTF-16 code unit order. */
function assertSorted(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) assertSorted(item);
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    assert.deepEqual(keys, keys.toSorted());
    for (const item of Object.values(value)) assertSorted(item);
  }
}

/** Serve the fixture until its comparison is ready and return its review bytes. */
async function servedReview(context: TestContext, root: string) {
  const running = await serve(context, root);
  try {
    const url = await running.ready();
    const { index } = await completed(url, context.signal, "home");
    assert.equal(index.changesStatus, "ready");
    const response = await fetch(new URL(index.comparisonUrl, `${url}/`), {
      signal: context.signal,
    });
    assert.equal(response.status, 200);
    return await response.text();
  } finally {
    await running.close();
  }
}

test(
  "build and Serve write the same compact review.json for one comparison",
  { timeout: 120_000 },
  async (context) => {
    const { root } = await fixture();
    try {
      const served = await servedReview(context, root);
      const built = await build(root, [], "plain", context.signal);
      const comparison = built.index.comparisonUrl;
      assert.ok(comparison);
      const file = await fs.readFile(
        path.join(built.output, comparison),
        "utf8",
      );
      assertCompact(file);
      assertSorted(JSON.parse(file));
      assert.equal(served, file);
      const removed = built.index.removedEntries[0];
      assert.ok(removed);
      const detail = await fs.readFile(
        path.join(
          built.output,
          path.posix.dirname(comparison),
          "entries",
          `${removed.entry.path}.json`,
        ),
        "utf8",
      );
      assert.ok(detail.startsWith('{\n  "'), detail.slice(0, 40));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
