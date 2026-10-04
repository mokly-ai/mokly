import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { parseRemovedPagePreview } from "@mokly/viewer/data";

import { readPreviewDescriptor } from "../../packages/viewer/dist/previews/descriptor.js";

/** Prove a captured page shell advertises metadata that reaches historical bytes. */
export async function assertPublishedPagePreview(
  output: string,
  published: { kind: "page" },
): Promise<void> {
  const shell = await fs.readFile(
    path.join(output, "view/pages/removed-page.html"),
    "utf8",
  );
  const raw = /data-mokly-preview="([^"]*)"/.exec(shell)?.[1];
  const descriptor = readPreviewDescriptor(
    raw === undefined
      ? null
      : raw
          .replaceAll("&quot;", '"')
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&"),
  );
  assert.deepEqual(descriptor?.published, published);
  const catalogue = JSON.parse(
    await fs.readFile(path.join(output, "mokly-viewer/catalogue.json"), "utf8"),
  ) as { comparisonUrl: string };
  const generation = path.posix.dirname(catalogue.comparisonUrl);
  const previewPath = `${generation}/pages/removed-page.json`;
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(output, previewPath), "utf8")),
  );
  assert.equal(preview.id, "removed-page");
  assert.match(
    await fs.readFile(
      path.join(
        output,
        generation,
        "snapshots/before/mokly-generated/pages/removed-page.html",
      ),
      "utf8",
    ),
    /Previous page/,
  );
}
