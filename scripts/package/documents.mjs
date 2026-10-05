import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/** Prove the packed parser renders documents and exports byte-exact resources. */
export async function inspectMarkdownDocuments(root, output, exported = false) {
  const base = path.join(
    root,
    output,
    exported ? "static" : "",
    "mokly-generated",
  );
  const html = await fs.readFile(
    path.join(base, "guides/markdown/index.html"),
    "utf8",
  );
  assert.match(html, /id="first-step"/);
  assert.match(html, /<table>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-mokly-link="guides"/);
  assert.deepEqual(
    await fs.readFile(path.join(base, "guides/diagram.svg")),
    await fs.readFile(path.join(root, "entries/guides/diagram.svg")),
  );
  if (exported) {
    const catalogue = JSON.parse(
      await fs.readFile(
        path.join(root, output, "mokly-viewer/catalogue.json"),
        "utf8",
      ),
    );
    assert.deepEqual(
      catalogue.documents.map((entry) => entry.path),
      ["guides", "guides/markdown"],
    );
    assert.ok(
      (
        await fs.stat(
          path.join(root, output, "view/guides/markdown/index.html"),
        )
      ).isFile(),
    );
  }
}
