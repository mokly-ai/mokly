/**
 * Install the opted-in standalone appearance from a classic browser asset.
 *
 * The document requests this ahead of the stylesheet, so the root carries the
 * stored, pinned or system appearance before the first paint. The body, the
 * frames and the Appearance control do not exist yet at that point, so the
 * install is finished once the DOM is ready.
 */

import { installAppearance } from "./startup.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const handle = installAppearance(
    {
      get body() {
        return document.body as unknown as {
          setAttribute(name: string, value: string): void;
        } | null;
      },
      documentElement: document.documentElement,
      querySelectorAll: (selector) =>
        document.querySelectorAll(selector) as unknown as Iterable<never>,
    },
    window,
  );
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => handle.refresh(), {
      once: true,
    });
  else handle.refresh();
}
