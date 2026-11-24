import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

export interface SampleLines {
  readonly source: string;
  readonly lines: readonly (number | null)[];
}

/** Mark authored body elements and map source lines to those markers. */
export function sampleLines(source: string): SampleLines {
  const frontmatter = /^---\n[\s\S]*?\n---(?:\n|$)/u.exec(source);
  if (!frontmatter)
    throw new Error("An HTML sample must start with front matter.");
  const bodyOffset = frontmatter[0].length;
  const body = source.slice(bodyOffset);
  const lineOffset = frontmatter[0].split("\n").length - 1;
  const elements: {
    line: number;
    start: number;
    end: number;
    insert: number;
  }[] = [];
  const walk = (node: DefaultTreeAdapterMap["node"]): void => {
    if ("tagName" in node) {
      const location = node.sourceCodeLocation;
      const tag = location?.startTag;
      if (location && tag) {
        elements.push({
          line: lineOffset + tag.startLine,
          start: bodyOffset + location.startOffset,
          end: bodyOffset + location.endOffset,
          insert: bodyOffset + tag.startOffset + 1 + node.tagName.length,
        });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
    if ("content" in node) walk(node.content);
  };
  walk(parseFragment(body, { sourceCodeLocationInfo: true }));
  let offset = 0;
  const lines = source.split("\n").map((text, index) => {
    const start = offset;
    offset += text.length + 1;
    if (start < bodyOffset || text.trim() === "") return null;
    const first = start + text.search(/\S/u);
    const starts = elements.find((element) => element.line === index + 1);
    const enclosing = elements
      .filter((element) => element.start <= first && first < element.end)
      .sort((a, b) => b.start - a.start)[0];
    return (starts ?? enclosing)?.line ?? null;
  });
  for (const element of elements.sort((a, b) => b.insert - a.insert)) {
    source =
      source.slice(0, element.insert) +
      ` data-sample-line="${element.line}"` +
      source.slice(element.insert);
  }
  return { source, lines };
}
