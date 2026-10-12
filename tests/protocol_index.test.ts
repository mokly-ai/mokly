import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("every top-level protocol document is linked from its index", async () => {
  const files = (await fs.readdir("docs/protocol")).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  const index = await fs.readFile("docs/protocol/README.md", "utf8");
  const links = new Set(
    [...index.matchAll(/\]\(\.\/([^\s)#]+\.md)(?:#[^)]*)?\)/g)].map(
      (match) => match[1],
    ),
  );
  assert.deepEqual(files.filter((name) => !links.has(name)).sort(), []);
});

test("inline resource delivery states that fingerprints retain stored references", async () => {
  const text = await fs.readFile(
    "docs/protocol/mokly-inline-style-resources.md",
    "utf8",
  );
  assert.match(text, /implements stored references for fingerprints/);
});
