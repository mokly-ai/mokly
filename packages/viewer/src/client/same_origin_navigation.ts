import {
  classifyFrameActivation,
  type FrameNavigationActions,
} from "./frame_navigation.js";
import { localFrameAccess } from "./same_origin_access.js";

const attachedFrames = new WeakSet<HTMLIFrameElement>();
const attachedDocuments = new WeakSet<Document>();

/** Attach enhancement to every immediate shell-owned fragment frame. */
export function attachLocalNavigation(
  doc: Document,
  actions: FrameNavigationActions,
): void {
  for (const frame of doc.querySelectorAll<HTMLIFrameElement>(
    "iframe.mbk-frag",
  )) {
    if (!attachedFrames.has(frame)) {
      attachedFrames.add(frame);
      frame.addEventListener("load", () => attachDocument(frame, actions));
    }
    attachDocument(frame, actions);
  }
}

function attachDocument(
  frame: HTMLIFrameElement,
  actions: FrameNavigationActions,
): void {
  let doc: Document | null;
  try {
    doc = localFrameAccess(frame).document();
  } catch {
    return;
  }
  if (!doc || attachedDocuments.has(doc)) return;
  attachedDocuments.add(doc);
  const activate = (event: Event): void => {
    const view = doc.defaultView;
    if (!view || !(event instanceof view.MouseEvent)) return;
    const source = event.target;
    if (!(source instanceof view.Element) || source.ownerDocument !== doc)
      return;
    const link = source.closest<HTMLElement>("[data-mokly-link]");
    if (!link || link.ownerDocument !== doc || !isNativeLink(link)) return;
    const action = classifyFrameActivation({
      altKey: event.altKey,
      button: event.button,
      ctrlKey: event.ctrlKey,
      download: link.hasAttribute("download"),
      eventType: event.type === "auxclick" ? "auxclick" : "click",
      marker: link.getAttribute("data-mokly-link") ?? "",
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      target: link.getAttribute("data-mokly-target"),
    });
    if (!action) return;
    event.preventDefault();
    if (action.kind === "navigate") actions.navigate(action.href);
    else actions.open(action.href, action.target);
  };
  doc.addEventListener("click", activate);
  doc.addEventListener("auxclick", activate);
}

function isNativeLink(element: Element): boolean {
  const namespace = element.namespaceURI;
  return (
    (namespace === "http://www.w3.org/1999/xhtml" &&
      (element.localName === "a" || element.localName === "area")) ||
    (namespace === "http://www.w3.org/2000/svg" && element.localName === "a")
  );
}
