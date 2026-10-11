import { assertReviewIgnoreId } from "../authoring/review_ignore.js";
import { TextOffsetMap, type TextPatch } from "../text_patches.js";

const BOUNDARY =
  /<template data-mokly-review-ignore-(start|end)="([^"]*)"><\/template>/g;
const MATERIAL = /<template data-mokly-review-material="([^"]*)"><\/template>/g;

/** Convert React's inert templates into layout-neutral Review comments. */
export function serializeReviewSentinels(html: string): string {
  return rewriteReviewSentinels(html).html;
}

/** Expose exact sentinel replacements for renderer ownership coordinates. */
export function rewriteReviewSentinels(html: string): {
  html: string;
  patches: readonly TextPatch[];
} {
  const patches: TextPatch[] = [];
  for (const match of html.matchAll(BOUNDARY)) {
    const [, boundary, id] = match;
    assertReviewIgnoreId(id!);
    patches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `<!--mokly-review-ignore:${boundary}:${id}-->`,
    });
  }
  for (const match of html.matchAll(MATERIAL)) {
    const value = match[1]!;
    const split = value.indexOf(":");
    const id = value.slice(0, split);
    const key = value.slice(split + 1);
    assertReviewIgnoreId(id, key);
    patches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `<!--mokly-review-material:${id}:${key}-->`,
    });
  }
  const serialized = new TextOffsetMap(html).apply(patches);
  if (serialized.includes("data-mokly-review-")) {
    throw new Error("[mokly/review-ignore] could not serialize a sentinel");
  }
  return { html: serialized, patches };
}
