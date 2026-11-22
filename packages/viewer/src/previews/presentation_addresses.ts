import { rewriteCss } from "./presentation_css.js";
import {
  asciiTrim,
  relativeAddress,
  rewriteSrcset,
} from "./presentation_url.js";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const TEXT_NODE = 3;

interface AddressWalk {
  base: string;
  embedded: boolean;
  transformSrcdoc(source: string): string;
}

/** Update references in one document or template and report any changes. */
export function rewriteDocumentAddresses(
  root: Document | DocumentFragment,
  walk: AddressWalk,
): boolean {
  let changed = false;
  for (const element of root.querySelectorAll("*")) {
    if (
      !walk.embedded &&
      (element.localName === "base" || isRefresh(element))
    ) {
      element.remove();
      changed = true;
      continue;
    }
    if (element.localName === "base" && element.hasAttribute("href")) {
      element.removeAttribute("href");
      changed = true;
    }
    for (const attribute of element.attributes) {
      const replacement = rewriteAttribute(element, attribute, walk.base);
      if (replacement !== undefined && replacement !== attribute.value) {
        attribute.value = replacement;
        changed = true;
      }
    }
    if (isTemplate(element) && rewriteDocumentAddresses(element.content, walk))
      changed = true;
    if (isStyle(element) && rewriteStyle(element, walk.base)) changed = true;
    if (
      isHtml(element, "iframe") &&
      rewriteSrcdoc(element, walk.transformSrcdoc)
    )
      changed = true;
  }
  return changed;
}

function isHtml(element: Element, name: string): boolean {
  return element.namespaceURI === HTML_NAMESPACE && element.localName === name;
}

function isTemplate(element: Element): element is HTMLTemplateElement {
  return isHtml(element, "template");
}

function isStyle(element: Element): boolean {
  return (
    isHtml(element, "style") ||
    (element.namespaceURI === SVG_NAMESPACE && element.localName === "style")
  );
}

function isHyperlink(element: Element): boolean {
  return (
    isHtml(element, "a") ||
    isHtml(element, "area") ||
    (element.namespaceURI === SVG_NAMESPACE && element.localName === "a")
  );
}

function isRefresh(element: Element): boolean {
  if (element.localName !== "meta") return false;
  const directive = element.getAttribute("http-equiv");
  return directive !== null && asciiTrim(directive).toLowerCase() === "refresh";
}

function rewriteAttribute(
  element: Element,
  { localName, namespaceURI, value }: Attr,
  base: string,
): string | undefined {
  if (namespaceURI === XLINK_NAMESPACE && localName === "href")
    return relativeAddress(value, base, isHyperlink(element));
  if (namespaceURI !== null) return;
  switch (localName) {
    case "href":
      return relativeAddress(value, base, isHyperlink(element));
    case "src":
    case "poster":
      return relativeAddress(value, base);
    case "data":
      return isHtml(element, "object")
        ? relativeAddress(value, base)
        : undefined;
    case "srcset":
      return rewriteSrcset(value, base);
    case "style":
      return rewriteCss(value, base);
  }
}

function rewriteStyle(element: Element, base: string): boolean {
  let changed = false;
  for (const child of element.childNodes) {
    if (child.nodeType !== TEXT_NODE || child.nodeValue === null) continue;
    const css = rewriteCss(child.nodeValue, base);
    if (css !== child.nodeValue) {
      child.nodeValue = css;
      changed = true;
    }
  }
  return changed;
}

function rewriteSrcdoc(
  element: Element,
  transform: AddressWalk["transformSrcdoc"],
): boolean {
  const source = element.getAttribute("srcdoc");
  if (source === null) return false;
  const markup = transform(source);
  if (markup === source) return false;
  element.setAttribute("srcdoc", markup);
  return true;
}
