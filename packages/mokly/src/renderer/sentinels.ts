import { assertReviewIgnoreId } from "../authoring/review_ignore.js";

const BOUNDARY =
  /<template data-mokly-review-ignore-(start|end)="([^"]*)"><\/template>/g;
const MATERIAL = /<template data-mokly-review-material="([^"]*)"><\/template>/g;

/** Convert React's inert templates into layout-neutral Review comments. */
export function serializeReviewSentinels(html: string): string {
  const boundaries = html.replace(
    BOUNDARY,
    (_all, boundary: string, id: string) => {
      assertReviewIgnoreId(id);
      return `<!--mokly-review-ignore:${boundary}:${id}-->`;
    },
  );
  const serialized = boundaries.replace(MATERIAL, (_all, value: string) => {
    const split = value.indexOf(":");
    const id = value.slice(0, split);
    const key = value.slice(split + 1);
    assertReviewIgnoreId(id, key);
    return `<!--mokly-review-material:${id}:${key}-->`;
  });
  if (serialized.includes("data-mokly-review-")) {
    throw new Error("[mokly/review-ignore] could not serialize a sentinel");
  }
  return serialized;
}
