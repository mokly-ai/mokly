import { isEligibleBrowseLink, isSameBrowseDocument } from "./navigation.js";

/** Keep native modified/external links outside progressive shell navigation. */
export function browseLinkTarget(
  event: MouseEvent,
  element: Element,
  location: Location,
): string | undefined {
  const anchor = element.closest("a");
  if (!anchor || event.defaultPrevented) return undefined;
  const url = new URL(anchor.href, location.href);
  return isEligibleBrowseLink({
    download: anchor.hasAttribute("download"),
    modified:
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0,
    pathname: url.pathname,
    sameOrigin: url.origin === location.origin,
    samePageHash:
      isSameBrowseDocument(new URL(location.href), url) && url.hash !== "",
    target: anchor.getAttribute("target") ?? "",
  })
    ? url.href
    : undefined;
}
