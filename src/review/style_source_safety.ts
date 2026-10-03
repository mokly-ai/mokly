/** Source-only guards shared by paired optimizations; no CSS analysis or base tree. */
import { decodeCssEscapes } from "./css/escape_decoding.js";
import type { InlineStyleSpan } from "./css/inline_styles.js";
import type { ReviewIgnoreRegion } from "./ignore.js";

/** Include both validated marker spellings, not only the region's content. */
export function pairedIgnoreTouchesStyles(
  styles: readonly InlineStyleSpan[],
  regions: readonly ReviewIgnoreRegion[],
): boolean {
  return regions.some((region) => {
    const start =
      region.start - `<!--mokly-review-ignore:start:${region.id}-->`.length;
    const end =
      region.end + `<!--mokly-review-ignore:end:${region.id}-->`.length;
    return styles.some((style) => style.start < end && start < style.end);
  });
}

/** Removing an eligible element must not hide review-marker validation in its tags. */
export function styleTagsContainReviewMarker(style: InlineStyleSpan): boolean {
  return [
    style.source.slice(0, style.contentStart! - style.start),
    style.source.slice(style.contentEnd! - style.start),
  ].some((tag) => tag.includes("<!--mokly-review-"));
}

const reservedMarker =
  /<(?:[\t\n\f\r !-]|\/\*[\s\S]*?\*\/)*[mM][oO][kK][lL][yY]-/;

/** A serializer-independent superset of literal, decoded and joined reserved markers. */
export function styleNeedsFullValidation(style: InlineStyleSpan): boolean {
  if (style.source.includes("<!--mokly-review-")) return true;
  if (reservedMarker.test(decodeCssEscapes(style.text))) return true;
  const continued = style.text.replace(/\\(?:\r\n|[\n\r\f])/g, "");
  return (
    continued !== style.text && reservedMarker.test(decodeCssEscapes(continued))
  );
}
