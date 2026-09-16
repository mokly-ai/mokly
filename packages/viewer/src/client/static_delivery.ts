import {
  parseStaticDelivery,
  resolveDeliveryHref,
  validFragmentQuery,
  type StaticDelivery,
} from "../navigation/delivery.js";

const STATIC_ATTRIBUTE = "data-mokly-static";
const DELIVERY_ATTRIBUTE = "data-mokly-delivery";

/** Read only shell-root metadata; missing static metadata fails closed. */
export function readStaticDelivery(doc: Document): StaticDelivery | undefined {
  const mode = doc.documentElement.getAttribute(STATIC_ATTRIBUTE);
  const raw = doc.documentElement.getAttribute(DELIVERY_ATTRIBUTE);
  if (mode === null && raw === null) return undefined;
  if (mode === "" && raw !== null) {
    try {
      const value = parseStaticDelivery(JSON.parse(raw));
      if (value) return value;
    } catch {
      /* Invalid metadata is handled identically to missing metadata. */
    }
  }
  throw new Error(
    "The exported catalogue information is unavailable. Reload the page.",
  );
}

/** Canonicalize static aliases while keeping their real content and scroll state. */
export function normalizeStaticAlias(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  try {
    const delivery = readStaticDelivery(doc);
    if (delivery && win.location.pathname.startsWith("/id/"))
      win.history.replaceState(
        win.history.state,
        "",
        `${delivery.canonicalPath}${validFragmentQuery(win.location.search)}`,
      );
  } catch {
    /* Ordinary document links remain usable without enhancement. */
  }
}

/** Resolve only validated id destinations for trusted parent frame activation. */
export function documentFrameHref(
  doc: Document,
  href: string,
): string | undefined {
  try {
    return resolveDeliveryHref(href, readStaticDelivery(doc));
  } catch {
    return undefined;
  }
}

/** Adopt a route's descriptor; a different deployment requires a full reload. */
export function adoptStaticDelivery(doc: Document, next: Document): boolean {
  try {
    const previous = readStaticDelivery(doc);
    const delivery = readStaticDelivery(next);
    if (!previous && !delivery) return true;
    if (
      !previous ||
      !delivery ||
      previous.deploymentId !== delivery.deploymentId ||
      previous.comparisonUrl !== delivery.comparisonUrl
    )
      return false;
    doc.documentElement.setAttribute(
      DELIVERY_ATTRIBUTE,
      JSON.stringify(delivery),
    );
    return true;
  } catch {
    return false;
  }
}
