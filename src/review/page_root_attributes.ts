/** Tokenize only rare missing-provenance start tags, never rewritten HTML or a second tree. */
import {
  Tokenizer,
  html,
  type DefaultTreeAdapterMap,
  type Token,
} from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type Span = { startOffset: number; endOffset: number };

export function rootAttributeLocations(
  source: string,
  document: DefaultTreeAdapterMap["document"],
  recipients: readonly Element[],
) {
  const blocked: { span: Span; bodyOnly: boolean }[] = [];
  const starts = new Set<number>();
  const visit = (node: Node) => {
    const location =
      "sourceCodeLocation" in node ? node.sourceCodeLocation : undefined;
    if (location) {
      if (
        node.nodeName === "#text" &&
        "parentNode" in node &&
        node.parentNode &&
        "tagName" in node.parentNode &&
        node.parentNode.namespaceURI !== html.NS.HTML
      )
        for (const section of source
          .slice(location.startOffset, location.endOffset)
          .matchAll(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/g))
          blocked.push({
            span: {
              startOffset: location.startOffset + section.index,
              endOffset:
                location.startOffset + section.index + section[0].length,
            },
            bodyOnly: false,
          });
      if ("tagName" in node) {
        const startTag = node.sourceCodeLocation?.startTag;
        if (startTag) {
          starts.add(startTag.startOffset);
          blocked.push({
            span: {
              startOffset: startTag.startOffset + 1,
              endOffset: startTag.endOffset,
            },
            bodyOnly: false,
          });
        }
        if (node.tagName === "template" || node.tagName === "select")
          blocked.push({ span: location, bodyOnly: node.tagName === "select" });
      } else if (
        node.nodeName === "#comment" ||
        (node.nodeName === "#text" &&
          "parentNode" in node &&
          node.parentNode &&
          "tagName" in node.parentNode &&
          node.parentNode.namespaceURI === html.NS.HTML &&
          [
            "script",
            "style",
            "textarea",
            "title",
            "xmp",
            "iframe",
            "noembed",
            "noframes",
            "noscript",
            "plaintext",
          ].includes(node.parentNode.tagName))
      )
        blocked.push({ span: location, bodyOnly: false });
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  };
  visit(document);
  const wanted = new Set(recipients.map(({ tagName }) => tagName));
  const result: { attribute: Element["attrs"][number]; location: Span }[] = [];
  for (const match of source.matchAll(/<([a-z][a-z0-9]*)(?=[\t\n\f\r />])/gi)) {
    const tag = match[1]!.toLowerCase();
    const offset = match.index;
    if (
      !wanted.has(tag) ||
      (starts.has(offset) && (tag === "html" || tag === "body")) ||
      blocked.some(
        ({ span, bodyOnly }) =>
          (!bodyOnly || tag === "body") &&
          span.startOffset <= offset &&
          offset < span.endOffset,
      )
    )
      continue;
    const token = startTag(source.slice(offset));
    if (!token?.location?.attrs) continue;
    for (const recipient of recipients) {
      if (recipient.tagName !== tag) continue;
      for (const attribute of recipient.attrs) {
        const candidate = token.attrs.find(
          (item) =>
            item.name === attribute.name && item.value === attribute.value,
        );
        const location = candidate && token.location.attrs[candidate.name];
        if (location && !result.some((item) => item.attribute === attribute))
          result.push({
            attribute,
            location: {
              startOffset: offset + location.startOffset,
              endOffset: offset + location.endOffset,
            },
          });
      }
    }
  }
  return result;
}

function startTag(source: string): Token.TagToken | undefined {
  let result: Token.TagToken | undefined;
  const tokenizer = new Tokenizer(
    { sourceCodeLocationInfo: true },
    {
      onStartTag(token) {
        result = token;
        tokenizer.pause();
      },
      onEndTag() {},
      onComment() {},
      onDoctype() {},
      onEof() {},
      onCharacter() {},
      onNullCharacter() {},
      onWhitespaceCharacter() {},
    },
  );
  tokenizer.write(source, true);
  return result;
}
