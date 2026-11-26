import assert from "node:assert/strict";
import test from "node:test";

import { DOCS_SECTIONS } from "../../../docs/mockups/src/screens/design/site/parts/docs_data.js";

import { PUBLISHED_PROTOCOLS } from "./helpers/published-protocols.js";

test("the docs mockup depicts the published Reference order", () => {
  const depicted = DOCS_SECTIONS.find(({ title }) => title === "Reference");
  assert.deepEqual(
    depicted?.pages,
    PUBLISHED_PROTOCOLS.map(([, , title]) => title),
  );
});
