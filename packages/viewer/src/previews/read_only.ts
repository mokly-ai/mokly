/**
 * Keep a previous version readable but inert. Scrolling, text selection and
 * same-document anchors work; links and forms never leave the preview or reach
 * current content. Frames the parent cannot reach are already withheld forms,
 * popups, downloads and top navigation by their sandbox.
 */

const guarded = new WeakSet<Document>();

function accessible(frame: HTMLIFrameElement): Document | undefined {
  try {
    return frame.contentDocument ?? undefined;
  } catch {
    return undefined;
  }
}

function activated(target: EventTarget | null, doc: Document): Element | null {
  const view = doc.defaultView;
  if (!view || !(target instanceof view.Element)) return null;
  return target.closest("a[href], area[href]");
}

/** Only an anchor into the same historical document keeps its default. */
function sameDocumentAnchor(link: Element, doc: Document): boolean {
  if (link.hasAttribute("download") || link.getAttribute("target"))
    return false;
  try {
    const target = new URL(link.getAttribute("href") ?? "", doc.baseURI);
    const here = new URL(doc.URL);
    return (
      target.hash !== "" &&
      target.origin === here.origin &&
      target.pathname === here.pathname &&
      target.search === here.search
    );
  } catch {
    return false;
  }
}

function guard(doc: Document): void {
  if (guarded.has(doc)) return;
  guarded.add(doc);
  const block = (event: Event): void => {
    const link = activated(event.target, doc);
    if (link && !sameDocumentAnchor(link, doc)) event.preventDefault();
  };
  doc.addEventListener("click", block, true);
  doc.addEventListener("auxclick", block, true);
  doc.addEventListener(
    "keydown",
    (event) => {
      const view = doc.defaultView;
      if (!view || !(event instanceof view.KeyboardEvent)) return;
      if (event.key === "Enter" || event.key === " ") block(event);
    },
    true,
  );
  doc.addEventListener("submit", (event) => event.preventDefault(), true);
}

/** Guard one historical frame now and after every document it loads. */
export function enforcePreviewReadOnly(frame: HTMLIFrameElement): void {
  const attach = (): void => {
    const doc = accessible(frame);
    if (doc) guard(doc);
  };
  frame.addEventListener("load", attach);
  attach();
}
