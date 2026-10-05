import { parseBrowsingTarget, resolveLinkPath } from "@mokly/viewer/data";
import {
  INTERACTIVE_NAVIGATION_EVENT,
  type LinkIdentity,
} from "@mokly/viewer/runtime";

import { referencedDefinition } from "../../authoring/identity.js";
import { DEFINITION_IDENTITY } from "../../authoring/markers.js";
import { parseAuthoredLink } from "../../build/authored_links.js";
import type { InteractiveRouteTable } from "../types.js";

import type { InteractiveDefinition } from "./definitions.js";

export interface ResolvedInteractiveLink {
  href: string;
  identity: LinkIdentity;
}

interface ResolvedRawLink {
  href: string | null;
  identity?: LinkIdentity;
  logical: string;
  target: string | null;
}

let routes: InteractiveRouteTable | undefined;
let baseTarget: string | undefined;
let source: InteractiveDefinition | undefined;

/** Install the immutable route table before React evaluates consumer links. */
export function configureInteractiveRoutes(
  next: InteractiveRouteTable,
  document?: Document,
  entry?: InteractiveDefinition,
): void {
  routes = next;
  source = entry;
  baseTarget =
    document
      ?.querySelector<HTMLBaseElement>("base[target]")
      ?.getAttribute("target") ?? undefined;
}

/** Distinguish an unconfigured static render from an unresolved Live target. */
export function interactiveRoutesConfigured(): boolean {
  return routes !== undefined;
}

/** Resolve one logical value without trusting a consumer-provided URL. */
export function resolveInteractiveLink(
  logical: string,
  targetValue?: string,
): ResolvedInteractiveLink | undefined {
  const destination = parseAuthoredLink(logical);
  const reference =
    destination?.path.startsWith("~definition-") && source
      ? referencedDefinition(destination.path, source)?.[DEFINITION_IDENTITY]
          .path
      : destination
        ? resolveLinkPath(destination.path, source?.linkBase ?? "")
        : undefined;
  const route =
    reference && routes && Object.hasOwn(routes, reference)
      ? routes[reference]
      : undefined;
  if (!destination || !reference || !route) return;
  const target = parseBrowsingTarget(targetValue ?? baseTarget);
  if (target.kind === "invalid") return;
  return {
    href: `${route.href}${destination.fragment ? `#${destination.fragment}` : ""}`,
    identity: {
      screenPath: reference,
      target,
      ...(destination.fragment ? { fragment: destination.fragment } : {}),
    },
  };
}

/** Emit the inspector-owned Live navigation event for an unmodified primary click. */
export function activateInteractiveLink(
  event: {
    altKey: boolean;
    button: number;
    ctrlKey: boolean;
    currentTarget: EventTarget | null;
    metaKey: boolean;
    preventDefault(): void;
    shiftKey: boolean;
  },
  identity: LinkIdentity,
  owner?: Element,
): void {
  const element = owner ?? (event.currentTarget as Element | null);
  if (
    !element ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    element.hasAttribute("download") ||
    inactive(element)
  )
    return;
  event.preventDefault();
  const view = element.ownerDocument.defaultView;
  element.dispatchEvent(
    new (view?.CustomEvent ?? CustomEvent)(INTERACTIVE_NAVIGATION_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: identity,
    }),
  );
}

/** Resolve raw `mock:` attributes after the initial mount and later commits. */
export function installInteractiveLinkResolver(document: Document): () => void {
  const rawLinks = new Map<Element, ResolvedRawLink>();
  const resolve = () => resolveDocumentLinks(document, rawLinks);
  const activate = (event: MouseEvent) => {
    const resolved = resolvedRawTarget(event.target, rawLinks);
    if (resolved?.identity)
      activateInteractiveLink(event, resolved.identity, resolved.element);
  };
  document.addEventListener("click", activate, true);
  const MutationObserver = document.defaultView?.MutationObserver;
  const observer = MutationObserver ? new MutationObserver(resolve) : undefined;
  try {
    resolve();
    observer?.observe(document.body, {
      attributeFilter: ["href", "data-nav-href", "target"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  } catch (error) {
    observer?.disconnect();
    document.removeEventListener("click", activate, true);
    rawLinks.clear();
    throw error;
  }
  return () => {
    observer?.disconnect();
    document.removeEventListener("click", activate, true);
    rawLinks.clear();
  };
}

function resolveDocumentLinks(
  document: Document,
  rawLinks: Map<Element, ResolvedRawLink>,
): void {
  refreshRawLinks(rawLinks);
  for (const element of document.querySelectorAll<Element>(
    "[href], [data-nav-href]",
  )) {
    for (const attribute of ["href", "data-nav-href"] as const) {
      const logical = element.getAttribute(attribute);
      if (!logical?.startsWith("mock:")) continue;
      element.removeAttribute(attribute);
      const target = element.getAttribute("target");
      if (attribute === "href" && nativeLink(element)) {
        updateRawLink(element, logical, target, rawLinks);
        continue;
      }
      const resolved = resolveInteractiveLink(logical, target ?? undefined);
      if (!resolved) continue;
      element.setAttribute(attribute, resolved.href);
    }
  }
}

function refreshRawLinks(rawLinks: Map<Element, ResolvedRawLink>): void {
  for (const [element, previous] of rawLinks) {
    if (!element.isConnected) {
      rawLinks.delete(element);
      continue;
    }
    const href = element.getAttribute("href");
    if (href !== previous.href) {
      rawLinks.delete(element);
      continue;
    }
    const target = element.getAttribute("target");
    if (target !== previous.target)
      updateRawLink(element, previous.logical, target, rawLinks);
  }
}

function updateRawLink(
  element: Element,
  logical: string,
  target: string | null,
  rawLinks: Map<Element, ResolvedRawLink>,
): void {
  const resolved = resolveInteractiveLink(logical, target ?? undefined);
  if (!resolved) {
    element.removeAttribute("href");
    rawLinks.set(element, { href: null, logical, target });
    return;
  }
  element.setAttribute("href", resolved.href);
  rawLinks.set(element, {
    href: resolved.href,
    identity: resolved.identity,
    logical,
    target,
  });
}

function resolvedRawTarget(
  target: EventTarget | null,
  rawLinks: ReadonlyMap<Element, ResolvedRawLink>,
): { element: Element; identity?: LinkIdentity } | undefined {
  let node = target as Node | null;
  while (node) {
    if (node.nodeType === 1) {
      const element = node as Element;
      const resolved = rawLinks.get(element);
      if (resolved)
        return {
          element,
          ...(resolved.identity ? { identity: resolved.identity } : {}),
        };
    }
    node = node.parentNode;
  }
  return;
}

function inactive(element: Element): boolean {
  return (
    element.hasAttribute("disabled") ||
    element.hasAttribute("inert") ||
    element.getAttribute("aria-disabled")?.toLowerCase() === "true" ||
    element.getAttribute("aria-busy")?.toLowerCase() === "true"
  );
}

function nativeLink(element: Element): boolean {
  const name = element.localName.toLowerCase();
  return name === "a" || name === "area";
}
