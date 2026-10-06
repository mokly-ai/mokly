import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designVariantDocument,
} from "./helpers/design_catalogue.js";

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: phone sample decorations stay hidden from assistive technology`, async () => {
    const { document } = await designVariantDocument(
      "design/library/preview/device-frame/phone",
      viewport,
    );
    for (const name of ["phone-home", "phone-notch"]) {
      const decorations = byClass(document, name);
      assert.equal(decorations.length, 1);
      assert.equal(attribute(decorations[0]!, "aria-hidden"), "true");
    }
  });
