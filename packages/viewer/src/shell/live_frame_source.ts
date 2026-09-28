/** Pure addressing for Live documents on Serve's separate interactive origin. */

import type { ViewerInteractiveDescriptor } from "../client/interactive_capability.js";

/** The parts of the shell's own location that name its browser-facing host. */
export interface ShellLocation {
  hostname: string;
  protocol: string;
}

/**
 * Use the descriptor's explicit forwarded origin, or the shell's own scheme and
 * host name with the announced Live port. Undefined means Live cannot be framed.
 */
export function liveFrameOrigin(
  descriptor: Pick<ViewerInteractiveDescriptor, "origin" | "port">,
  shell: ShellLocation,
): string | undefined {
  if (descriptor.origin) return descriptor.origin;
  if (shell.protocol !== "http:" && shell.protocol !== "https:") return;
  try {
    return new URL(
      `${shell.protocol}//${shell.hostname}:${String(descriptor.port)}`,
    ).origin;
  } catch {
    return;
  }
}

/**
 * Address the same `/static/` document, query and fragment on the Live origin.
 * Anything else, such as a temporary control preview, has no Live document.
 */
export function liveFrameSource(
  source: string,
  frameOrigin: string,
): string | undefined {
  try {
    const local = new URL(source, "http://mokly.invalid/");
    if (!local.pathname.startsWith("/static/")) return;
    const live = new URL(
      `${local.pathname}${local.search}${local.hash}`,
      frameOrigin,
    );
    return live.origin === frameOrigin ? live.href : undefined;
  } catch {
    return;
  }
}
