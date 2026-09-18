/** Fetch a coherent destination without allowing an older snapshot to undo evidence updates. */
import { readPageStamp } from "./browse_update_state.js";
import type { NavigationSequencer } from "./navigation.js";
import { adoptStaticDelivery } from "./static_delivery.js";

export async function fetchBrowseDestination(
  doc: Document,
  win: Window & typeof globalThis,
  url: string,
  slot: ReturnType<NavigationSequencer["begin"]>,
): Promise<{ parsed: Document; view: Element; url: string } | undefined> {
  try {
    while (slot.isCurrent()) {
      const response = await win.fetch(url, {
        headers: { accept: "text/html" },
        signal: slot.signal,
        cache: "no-store",
      });
      if (!response.ok && response.status !== 404) break;
      const html = await response.text();
      if (!slot.isCurrent()) return;
      const parsed = new win.DOMParser().parseFromString(html, "text/html");
      const currentStamp = readPageStamp(doc);
      const nextStamp = readPageStamp(parsed);
      if (currentStamp) {
        if (!nextStamp || nextStamp.content !== currentStamp.content) break;
        if (nextStamp.version < currentStamp.version) continue;
      }
      const view = parsed.querySelector("[data-mokly-view]");
      if (!view || !adoptStaticDelivery(doc, parsed)) break;
      return { parsed, view, url: response.url || url };
    }
  } catch {
    // A current failed navigation falls back to its durable URL.
  }
  if (slot.isCurrent()) win.location.assign(url);
  return undefined;
}
