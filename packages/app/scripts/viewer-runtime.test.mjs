import assert from "node:assert/strict";
import { test } from "node:test";

import { assertViewerRuntime } from "./viewer-runtime.mjs";

test("the web build requires the package shell and the released version headline", () => {
  const markers = [
    "data-mokly-shell",
    "This catalogue needs a compatible viewer",
  ];
  assert.doesNotThrow(() => assertViewerRuntime(markers.join(" ")));
  for (const marker of markers) {
    assert.throws(
      () =>
        assertViewerRuntime(
          markers.filter((value) => value !== marker).join(" "),
        ),
      /published viewer runtime/,
    );
  }
});

test("cloud catalogue and selection strings do not prove the viewer runtime", () => {
  assert.throws(
    () =>
      assertViewerRuntime(
        "data-mokly-shell mokly-viewer/index.json screenPath",
      ),
    /published viewer runtime/,
  );
});
