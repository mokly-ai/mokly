import assert from "node:assert/strict";

import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { parseStaticDelivery } from "../../packages/viewer/dist/navigation/delivery.js";
import type { ReviewArtifactContent } from "../../packages/viewer/dist/review/types.js";

/** Read the actual root descriptor from an exported shell document. */
export function exportedDelivery(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  name = "index.html",
) {
  const bytes = files.get(name);
  assert.ok(bytes !== undefined, name);
  const document = parse(Buffer.from(bytes).toString("utf8"));
  const root = document.childNodes.find((node) => node.nodeName === "html") as
    DefaultTreeAdapterTypes.Element | undefined;
  const raw = root?.attrs.find(
    (attribute) => attribute.name === "data-mokly-delivery",
  )?.value;
  assert.ok(raw, `missing delivery metadata in ${name}`);
  const delivery = parseStaticDelivery(JSON.parse(raw));
  assert.ok(delivery, `invalid delivery metadata in ${name}`);
  return delivery;
}
