import { parse, type DefaultTreeAdapterMap } from "parse5";

import { parseLogicalMarker } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const elements = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "li",
  "hr",
  "pre",
  "code",
  "em",
  "strong",
  "del",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "input",
  "br",
]);
const attributes: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "title", "data-mokly-link"],
  img: ["src", "alt", "title"],
  ol: ["start"],
  code: ["class"],
  input: ["type", "disabled", "checked"],
  th: ["align"],
  td: ["align"],
};

/** Validate the final parsed document, independently of the Markdown renderer. */
export function validateDocumentHtml(html: string, location: string): void {
  const document = parse(html);
  const fail = (reason: string): never => {
    throw new MoklyError(
      "build-invalid",
      `${location}: unsafe rendered document: ${reason}`,
    );
  };
  const visit = (node: Node, parent?: Element): void => {
    if ("tagName" in node) {
      const tag = node.tagName;
      const wrapper = ["html", "head", "body"].includes(tag);
      const head =
        parent?.tagName === "head" && ["meta", "title", "style"].includes(tag);
      const main = tag === "main" && parent?.tagName === "body";
      if (
        node.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
        !(wrapper || head || main || elements.has(tag))
      )
        fail(`element <${tag}> is not allowed`);
      for (const attr of node.attrs) {
        if (
          attr.namespace ||
          attr.prefix ||
          !allowedAttribute(tag, attr.name, attr.value)
        )
          fail(`attribute ${attr.name} on <${tag}> is not allowed`);
        if (
          (attr.name === "href" || attr.name === "src") &&
          !allowedUrl(attr.value)
        )
          fail(`${attr.name} on <${tag}> is not an allowed URL`);
      }
      if (
        tag === "input" &&
        !node.attrs.some((attr) => attr.name === "disabled")
      )
        fail("<input> must be disabled");
      if (
        tag === "input" &&
        !node.attrs.some(
          (attr) => attr.name === "type" && attr.value === "checkbox",
        )
      )
        fail("<input> must have checkbox type");
      if (
        tag === "head" &&
        node.childNodes.filter(
          (child) => "tagName" in child && child.tagName === "style",
        ).length !== 1
      )
        fail("the template must contain one owned stylesheet");
      parent = node;
    }
    if ("childNodes" in node)
      for (const child of node.childNodes) visit(child, parent);
  };
  visit(document);
}

function allowedAttribute(tag: string, name: string, value: string): boolean {
  if (tag === "html")
    return (
      (name === "lang" && value === "en") ||
      (name === "style" && /^color-scheme: (?:light|dark)$/.test(value))
    );
  if (tag === "meta")
    return (
      (name === "charset" && value === "utf-8") ||
      (name === "name" && value === "viewport") ||
      (name === "content" && value === "width=device-width, initial-scale=1")
    );
  if (/^h[1-6]$/.test(tag))
    return name === "id" && /^[\p{L}\p{N}\p{M}_-]+$/u.test(value);
  if (!attributes[tag]?.includes(name)) return false;
  if (name === "type") return value === "checkbox";
  if (name === "disabled" || name === "checked") return value === "";
  if (name === "align") return ["left", "center", "right"].includes(value);
  if (name === "start") return /^\d{1,9}$/.test(value);
  if (name === "class")
    return value.startsWith("language-") && value.length > 9;
  if (name === "data-mokly-link")
    return parseLogicalMarker(value) !== undefined;
  return true;
}

function allowedUrl(value: string): boolean {
  if (
    !value ||
    value.trim() !== value ||
    value.includes("\\") ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return false;
  const scheme = /^[A-Za-z][A-Za-z\d+.-]*:/.exec(value)?.[0];
  if (scheme) return /^(?:https?|mailto):$/i.test(scheme);
  return !value.startsWith("/") && !/^[^/?#]*:/.test(value);
}
