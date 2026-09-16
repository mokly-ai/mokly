/** Trusted parent enhancement for logical links in immediate Browse frames. */

import { logicalMarker, parseLogicalMarker } from "../navigation/logical.js";
import { parseBrowsingTarget } from "../navigation/target.js";

import { attachLocalNavigation } from "./same_origin_navigation.js";

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

/** Callbacks owned by the outer Browse navigation lifecycle. */
export interface FrameNavigationActions {
  navigate(href: string): void;
  open(href: string, target: string): void;
}

/** Classify an activation without trusting a portable href. */
export function classifyFrameActivation(
  candidate: FrameActivationCandidate,
): FrameActivation | undefined {
  const destination = parseLogicalMarker(candidate.marker);
  if (!destination || logicalMarker(destination) !== candidate.marker) {
    return undefined;
  }
  if (candidate.download || candidate.altKey) return undefined;
  if (candidate.eventType === "click" && candidate.button !== 0)
    return undefined;
  if (candidate.eventType === "auxclick" && candidate.button !== 1) {
    return undefined;
  }
  const target = parseBrowsingTarget(candidate.target);
  if (target.kind === "invalid") return undefined;
  const href = `/id/${encodeURIComponent(destination.id)}${
    destination.fragment
      ? `?fragment=${encodeURIComponent(destination.fragment)}`
      : ""
  }`;
  if (target.kind === "top" || target.kind === "parent") {
    return { href, kind: "navigate" };
  }
  if (target.kind === "blank") return { href, kind: "open", target: "_blank" };
  if (target.kind === "named") {
    return { href, kind: "open", target: target.name };
  }
  const modified = candidate.metaKey || candidate.ctrlKey || candidate.shiftKey;
  return modified || candidate.eventType === "auxclick"
    ? { href, kind: "open", target: "_blank" }
    : { href, kind: "navigate" };
}

/** Attach through the local adapter's existing-document capability. */
export function attachFrameNavigation(
  doc: Document,
  actions: FrameNavigationActions,
): void {
  attachLocalNavigation(doc, actions);
}
