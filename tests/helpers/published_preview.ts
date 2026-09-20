import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { parseRemovedPagePreview } from "@mokly/viewer/data";

import { readPreviewDescriptor } from "../../packages/viewer/dist/previews/descriptor.js";

/** Prove a captured page shell advertises metadata that reaches historical bytes. */
export async function assertPublishedPagePreview(
  output: string,
  published: { kind: "page"; path: string },
): Promise<void> {
  const shell = await fs.readFile(
    path.join(output, "view/archive/removed.html"),
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
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(output, published.path), "utf8")),
  );
  const generation = path.posix.dirname(
    path.posix.dirname(path.posix.dirname(published.path)),
  );
  assert.match(
    await fs.readFile(
      path.join(output, generation, preview.documentPath),
      "utf8",
    ),
    /Previous page/,
  );
}
