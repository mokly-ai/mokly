import assert from "node:assert/strict";
import { test } from "node:test";

import {
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

const MOVED = "design/changes/outcomes/moved";

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: the moved comparison names its previous path in the runtime's words`, async () => {
    const { document } = await designDocument(MOVED, viewport);
    const details = byClass(document, "mbk-comparison-details")[0];
    assert.ok(details, "missing comparison details");
    assert.deepEqual(
      elements(details, (node) => node.tagName === "p").map((paragraph) =>
        textContent(paragraph).replace(/\s+/gu, " ").trim(),
      ),
      [
        "Compared with the branch point on origin/main.",
        "The previous version is at billing/invoice, where it was before the move.",
      ],
    );
  });
