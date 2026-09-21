/** Pure classification for logical activations in same-origin frames. */

import { logicalMarker, parseLogicalMarker } from "../navigation/logical.js";
import { parseBrowsingTarget } from "../navigation/target.js";

import type { FrameEvent } from "./frame_adapter.js";
import type { AuthenticatedDocument } from "./same_origin_identity.js";

/** Input facts for one marked frame-link activation. */
export interface FrameActivationCandidate {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  download: boolean;
  eventType: "auxclick" | "click";
  marker: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: string | null;
}

/** Parent-owned action derived from a trusted marked link. */
export type FrameActivation =
  | { href: string; kind: "navigate" }
  | { href: string; kind: "open"; target: string };

/** Classify an activation without trusting a portable href. */
export function classifyFrameActivation(
  candidate: FrameActivationCandidate,
): FrameActivation | undefined {
  const destination = parseLogicalMarker(candidate.marker);
  if (!destination || logicalMarker(destination) !== candidate.marker)
    return undefined;
  if (candidate.download || candidate.altKey) return undefined;
  if (candidate.eventType === "click" && candidate.button !== 0)
    return undefined;
  if (candidate.eventType === "auxclick" && candidate.button !== 1)
    return undefined;
  const target = parseBrowsingTarget(candidate.target);
  if (target.kind === "invalid") return undefined;
  const href = `/id/${encodeURIComponent(destination.id)}${
    destination.fragment
      ? `?fragment=${encodeURIComponent(destination.fragment)}`
      : ""
  }`;
  if (target.kind === "top" || target.kind === "parent")
    return { href, kind: "navigate" };
  if (target.kind === "blank") return { href, kind: "open", target: "_blank" };
  if (target.kind === "named")
    return { href, kind: "open", target: target.name };
  const modified = candidate.metaKey || candidate.ctrlKey || candidate.shiftKey;
  return modified || candidate.eventType === "auxclick"
    ? { href, kind: "open", target: "_blank" }
    : { href, kind: "navigate" };
}

/** Install native logical-link interception for one authenticated document. */
export function listenForFrameActivations(
  doc: AuthenticatedDocument,
  signal: AbortSignal,
  enabled: () => boolean,
  emit: (event: FrameEvent) => void,
): void {
  const activate = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest?.(
      "[data-mokly-link]",
    );
    if (!link || !enabled() || !["a", "area"].includes(link.localName)) return;
    const marker = link.getAttribute("data-mokly-link") ?? "";
    const target = parseBrowsingTarget(link.getAttribute("data-mokly-target"));
    const destination = parseLogicalMarker(marker);
    if (
      !destination ||
      target.kind === "invalid" ||
      !classifyFrameActivation({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        download: link.hasAttribute("download"),
        eventType: event.type === "click" ? "click" : "auxclick",
        marker,
        target: link.getAttribute("data-mokly-target"),
      })
    )
      return;
    event.preventDefault();
    emit({
      type: "navigation",
      navigation: {
        ...destination,
        target,
        activation:
          event.type === "auxclick"
            ? "middle"
            : event.metaKey || event.ctrlKey || event.shiftKey
              ? "modified"
              : "primary",
      },
    });
  };
  doc.addEventListener("click", activate, { signal });
  doc.addEventListener("auxclick", activate, { signal });
}
