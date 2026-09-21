/** Keep a viewer-owned historical document readable but inert. */

import type { PreviewPresentation } from "./presentation.js";

const guarded = new WeakSet<Document>();

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
        candidate.matches("a[href], area[href]"),
    );
}

function fragmentName(link: Element, doc: Document, source: string) {
  let target: URL;
  try {
    target = new URL(link.getAttribute("href") ?? "", doc.baseURI);
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
  presentation: PreviewPresentation,
): void {
  const name = fragmentName(link, doc, presentation.snapshotAddress);
  if (!name) return;
  const target =
    doc.getElementById(name) ??
    Array.from(doc.getElementsByName(name)).find(
      (candidate) => candidate.localName === "a",
    );
  target?.scrollIntoView();
}

function guard(doc: Document, presentation: PreviewPresentation): void {
  if (guarded.has(doc)) return;
  guarded.add(doc);
  const block = (event: Event): void => {
    const link = activated(event, doc);
    if (!link) return;
    event.preventDefault();
    scrollToFragment(link, doc, presentation);
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

/** Guard one accepted presentation and restore it after any later navigation. */
export function enforcePreviewReadOnly(
  frame: HTMLIFrameElement,
  presentation: PreviewPresentation,
): () => void {
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
      guard(doc, presentation);
      return;
    }
    if (recorded && doc !== recorded && !restoring) {
      restoring = true;
      frame.srcdoc = presentation.srcdoc;
      return;
    }
    if (doc === recorded) guard(doc, presentation);
  };
  frame.addEventListener("load", attach);
  attach();
  return () => frame.removeEventListener("load", attach);
}
