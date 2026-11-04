/** Pure classification for logical activations in same-origin frames. */

import type { FrameEvent, FrameNavigation } from "@mokly/frame";
import {
  frameLinkActivation,
  logicalMarker,
  parseLogicalMarker,
  parseBrowsingTarget,
} from "@mokly/frame/internal";

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

/** Classify an activation without trusting a portable href. */
export function classifyFrameActivation(
  candidate: FrameActivationCandidate,
): FrameNavigation | undefined {
  const destination = parseLogicalMarker(candidate.marker);
  if (!destination || logicalMarker(destination) !== candidate.marker)
    return undefined;
  const activation = frameLinkActivation(
    { ...candidate, type: candidate.eventType },
    candidate.download,
  );
  if (!activation) return;
  const target = parseBrowsingTarget(candidate.target);
  if (target.kind === "invalid") return undefined;
  return {
    screenPath: destination.path,
    ...(destination.fragment === undefined
      ? {}
      : { fragment: destination.fragment }),
    target,
    activation,
  };
}

/** Read the served marker without using a portable href as a logical route. */
export function classifyLocalActivation(
  event: MouseEvent,
): FrameNavigation | undefined {
  const link = (event.target as Element | null)?.closest?.("[data-mokly-link]");
  if (!link || !["a", "area"].includes(link.localName)) return;
  return classifyFrameActivation({
    altKey: event.altKey,
    button: event.button,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    download: link.hasAttribute("download"),
    eventType: event.type === "click" ? "click" : "auxclick",
    marker: link.getAttribute("data-mokly-link") ?? "",
    target: link.getAttribute("data-mokly-target"),
  });
}

/** Own navigation before the authenticated replacement finishes loading. */
export function listenForFrameActivations(
  doc: AuthenticatedDocument,
  signal: AbortSignal,
  enabled: () => boolean,
  emit: (event: FrameEvent) => void,
): void {
  const activate = (event: MouseEvent) => {
    if (!enabled()) return;
    const navigation = classifyLocalActivation(event);
    if (!navigation) return;
    event.preventDefault();
    emit({
      type: "navigation",
      navigation,
    });
  };
  doc.addEventListener("click", activate, { signal });
  doc.addEventListener("auxclick", activate, { signal });
}
