import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import { generatedBytes } from "../../dist/build/generated_file.js";

/** Require the same fields, manifest, output order and bytes, and inputs. */
export function assertSameCompilation(
  actual: Compilation,
  expected: Compilation,
): void {
  assert.deepStrictEqual(
    Object.keys(actual).sort(),
    Object.keys(expected).sort(),
    "compilation fields differ",
  );
  assert.deepStrictEqual(actual.diagnostics, expected.diagnostics);
  assert.deepStrictEqual(actual.manifest, expected.manifest);
  assert.deepStrictEqual(
    [...actual.outputs.keys()],
    [...expected.outputs.keys()],
  );
  for (const [route, content] of expected.outputs) {
    const received = actual.outputs.get(route)!;
    assert.equal(typeof received, typeof content, `${route} changed kind`);
    assert.ok(
      generatedBytes(received).equals(generatedBytes(content)),
      `${route} changed bytes`,
    );
  }
  assert.deepStrictEqual(
    actual.deliveredStyleSources,
    expected.deliveredStyleSources,
  );
  assert.deepStrictEqual(actual.documentMarkdown, expected.documentMarkdown);
}
