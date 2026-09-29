/** The shell's one polite status region for route and status messages. */

import { useShellIdentifier } from "./identifier_context.js";
import { useShellStore } from "./store_context.js";

/**
 * The visually hidden, atomic `#mb-status` region. Each announcement key gets
 * its own text node, so an explicit announcement is spoken again even when it
 * repeats the text already in the region.
 */
export function ShellStatusRegion() {
  const store = useShellStore();
  const id = useShellIdentifier("mb-status");
  const { announcement, announcementKey } = store.state;
  return (
    <p
      aria-atomic="true"
      aria-live="polite"
      className="mbk-route-status"
      id={id}
      role="status"
    >
      {announcement ? <span key={announcementKey}>{announcement}</span> : null}
    </p>
  );
}
