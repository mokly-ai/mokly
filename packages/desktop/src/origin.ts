/** The domain-owned origin is pinned to fixtures/desktop-origin.json in tests. */
export const DESKTOP_ORIGIN = "mokly-app://desktop";

/** Node's URL.origin is null for a custom scheme, so compare its authority. */
export function isDesktopAddress(url: URL): boolean {
  return (
    url.protocol === "mokly-app:" &&
    url.host === "desktop" &&
    !url.username &&
    !url.password
  );
}
