import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  componentDesignRoutes,
  designArtboardUrl,
} from "./browser/design/artboards.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("raw design URLs use exact viewport and scheme artifacts", () => {
  const entry = "design/browse/appearance/overview";
  for (const viewport of ["mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const)
      assert.equal(
        designArtboardUrl(entry, viewport, scheme),
        pathToFileURL(
          path.join(
            repositoryRoot,
            "examples/basic/generated",
            entry,
            `index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`,
          ),
        ).href,
      );
  assert.equal(componentDesignRoutes.length, 39);
  assert.match(
    designArtboardUrl("design/library/preview/device-frame/phone", "mobile"),
    /\/index\.mobile\.html$/u,
  );
});

test("raw design URLs reject runtime content, missing entries, and unavailable schemes", () => {
  assert.throws(
    () => designArtboardUrl("example/screens/welcome", "desktop"),
    /Unknown design artboard/u,
  );
  assert.throws(
    () => designArtboardUrl("design/unknown", "mobile"),
    /Unknown design artboard/u,
  );
  assert.throws(
    () => designArtboardUrl("design/components/overview", "desktop", "dark"),
    /Missing dark design artboard/u,
  );
});
