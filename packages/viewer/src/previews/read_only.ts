/** Keep a viewer-owned snapshot document readable but inert. */

import type { SnapshotPresentation } from "./presentation.js";
import {
  browserFrameScheduler,
  followPresentedDocument,
  type FrameScheduler,
} from "./presented_document.js";

const guarded = new WeakSet<Document>();
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

/** How a guarded presentation shows anchors and follows its documents. */
export interface PreviewReadOnlyOptions {
  /**
   * Show the target without navigating; defaults to scrolling it into view
   * inside the frame. Comparison panes move their shared viewport instead.
   */
  reveal?(target: Element): void;
  /** Animation frames used to follow replacement documents. */
  scheduler?: FrameScheduler;
}

function scrollIntoView(target: Element): void {
  target.scrollIntoView();
}

function accessible(frame: HTMLIFrameElement): Document | undefined {
  try {
    return frame.contentDocument ?? undefined;
  } catch {
    return undefined;
  }
}

function activated(event: Event, doc: Document): Element | undefined {
  const view = doc.defaultView;
  if (!view) return;
  return event
    .composedPath()
    .find(
      (candidate): candidate is Element =>
        candidate instanceof view.Element &&
        (candidate.localName === "a" || candidate.localName === "area"),
    );
}

function fragmentName(link: Element, doc: Document, source: string) {
  let target: URL;
  try {
    const href =
      link.getAttribute("href") ??
      link.getAttributeNS(XLINK_NAMESPACE, "href") ??
      "";
    target = new URL(href, doc.baseURI);
  } catch {
    return;
  }
  if (!target.hash) return;
  const encoded = target.hash.slice(1);
  target.hash = "";
  if (target.href !== source) return;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function scrollToFragment(
  link: Element,
  doc: Document,
  presentation: SnapshotPresentation,
  reveal: (target: Element) => void,
): void {
  const name = fragmentName(link, doc, presentation.snapshotAddress);
  if (!name) return;
  const target =
    doc.getElementById(name) ??
    Array.from(doc.getElementsByName(name)).find(
      (candidate) => candidate.localName === "a",
    );
  if (target) reveal(target);
}

function guard(
  doc: Document,
  presentation: SnapshotPresentation,
  reveal: (target: Element) => void,
): void {
  if (guarded.has(doc)) return;
  guarded.add(doc);
  const block = (event: Event): void => {
    const link = activated(event, doc);
    if (!link) return;
    event.preventDefault();
    scrollToFragment(link, doc, presentation, reveal);
  };
  doc.addEventListener("click", block, true);
  doc.addEventListener("auxclick", block, true);
  doc.addEventListener(
    "keydown",
    (event) => {
      const view = doc.defaultView;
      if (view && event instanceof view.KeyboardEvent && event.key === "Enter")
        block(event);
    },
    true,
  );
  doc.addEventListener("submit", (event) => event.preventDefault(), true);
}

/**
 * Guard one accepted presentation from the moment its document commits, not
 * only once slow resources let it load, and restore it after any navigation.
 */
export function enforcePreviewReadOnly(
  frame: HTMLIFrameElement,
  presentation: SnapshotPresentation,
  options: PreviewReadOnlyOptions = {},
): () => void {
  const reveal = options.reveal ?? scrollIntoView;
  let recorded: Document | undefined;
  let restoring = false;
  const attach = (): void => {
    const doc = accessible(frame);
    if (!doc) {
      if (recorded && !restoring) {
        restoring = true;
        frame.srcdoc = presentation.srcdoc;
      }
      return;
    }
    if (doc.URL === "about:srcdoc" && (!recorded || restoring)) {
      recorded = doc;
      restoring = false;
      guard(doc, presentation, reveal);
      return;
    }
    if (recorded && doc !== recorded && !restoring) {
      restoring = true;
      frame.srcdoc = presentation.srcdoc;
      return;
    }
    if (doc === recorded) guard(doc, presentation, reveal);
  };
  return followPresentedDocument(
    frame,
    options.scheduler ?? browserFrameScheduler,
    attach,
  );
}
