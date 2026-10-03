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

/** Quick checks cannot predict how canonicalization removes review markers. */
export function styleNeedsFullValidation(style: InlineStyleSpan): boolean {
  return (
    style.source.includes("<!--mokly-review-") ||
    /<!--[mM][oO][kK][lL][yY]-/.test(decodeCssEscapes(style.text))
  );
}
