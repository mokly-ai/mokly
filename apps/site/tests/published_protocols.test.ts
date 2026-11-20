import assert from "node:assert/strict";
import test from "node:test";

import { publishedProtocols } from "./helpers/published-protocols.js";

const TABLE = `## Published Protocol Documents

| Order | Package source | Reference slug |
| ----- | -------------- | -------------- |
| 1 | \`docs/protocol/mokly-upload.md\` | \`upload\` |
| 2 | \`docs/protocol/mokly-upload-exchange.md\` | \`upload-exchange\` |

## Versions And Releases

| This table | is outside | the section |
`;

test("the published protocol parser preserves package source, slug and order", () => {
  assert.deepEqual(publishedProtocols(TABLE), [
    { order: 1, source: "docs/protocol/mokly-upload.md", slug: "upload" },
    {
      order: 2,
      source: "docs/protocol/mokly-upload-exchange.md",
      slug: "upload-exchange",
    },
  ]);
});

test("the published protocol parser reports missing tables and malformed rows", () => {
  assert.throws(
    () => publishedProtocols("## Other\n"),
    /Missing Published Protocol/,
  );
  assert.throws(
    () => publishedProtocols("## Published Protocol Documents\n"),
    /Invalid Published Protocol/,
  );
  for (const row of [
    "2 | `docs/protocol/mokly-upload-exchange.md` | `upload-exchange` |",
    "| 2 | `docs/protocol/mokly-upload-exchange.md` | |",
    "| 2 | `docs/protocol/mokly-upload-exchange.md` | `upload-exchange` | extra |",
    "| x | `docs/protocol/mokly-upload-exchange.md` | `upload-exchange` |",
  ]) {
    assert.throws(
      () =>
        publishedProtocols(
          TABLE.replace(
            "| 2 | `docs/protocol/mokly-upload-exchange.md` | `upload-exchange` |",
            row,
          ),
        ),
      /Invalid published protocol row/,
    );
  }
});
