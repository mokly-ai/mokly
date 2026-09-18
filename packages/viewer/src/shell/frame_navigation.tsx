/** Effect-safe same-origin frame navigation for the hydrated shell. */

import { useEffect, useRef } from "react";

import { localFrameAccess } from "../client/same_origin_access.js";
import { classifyFrameActivation } from "../client/same_origin_mount.js";

import { useShellStore } from "./store_context.js";

/** Subscribe trusted immediate frames to the shell route actions. */
export function FrameNavigationBridge() {
  const store = useShellStore();
  const latest = useRef(store);
  latest.current = store;
  const route = JSON.stringify([
    store.state.route.view.kind === "target"
      ? store.state.route.view.target.entry.id
      : store.state.route.view.kind,
    store.state.route.fragment,
    store.state.route.variant,
    store.state.selection.colorScheme,
  ]);
  useEffect(() => {
    if (!store.interactive) return;
    const controller = new AbortController();
    const signal = controller.signal;
    for (const frame of document.querySelectorAll<HTMLIFrameElement>(
      "iframe.mbk-frag",
    )) {
      let documentController: AbortController | undefined;
      const attach = () => {
        documentController?.abort();
        documentController = new AbortController();
        signal.addEventListener("abort", () => documentController?.abort(), {
          once: true,
        });
        let doc: Document | null;
        try {
          doc = localFrameAccess(frame).document();
        } catch {
          return;
        }
        if (!doc?.defaultView) return;
        const activate = (event: Event) => {
          const view = doc?.defaultView;
          if (!view || !(event instanceof view.MouseEvent)) return;
          const source = event.target;
          if (!(source instanceof view.Element) || source.ownerDocument !== doc)
            return;
          const link = source.closest("[data-mokly-link]");
          if (!link || link.ownerDocument !== doc || !nativeLink(link)) return;
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
          if (action.kind === "navigate")
            latest.current.navigateFrame(action.href);
          else latest.current.openFrame(action.href, action.target);
        };
        doc.addEventListener("click", activate, {
          signal: documentController.signal,
        });
        doc.addEventListener("auxclick", activate, {
          signal: documentController.signal,
        });
      };
      frame.addEventListener("load", attach, { signal });
      attach();
    }
    return () => controller.abort();
  }, [route, store.interactive]);
  return null;
}

function nativeLink(element: Element): boolean {
  return (
    (element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
      (element.localName === "a" || element.localName === "area")) ||
    (element.namespaceURI === "http://www.w3.org/2000/svg" &&
      element.localName === "a")
  );
}
