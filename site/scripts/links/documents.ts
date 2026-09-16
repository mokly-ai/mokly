import { transform } from "lightningcss";
import type { DefaultTreeAdapterMap } from "parse5";
import { parse } from "parse5";
import { parseSrcset } from "srcset";

export interface LinkDocument {
  readonly ids: Set<string>;
  readonly references: string[];
  readonly base: string | undefined;
}

/** Parse CSS dependencies without mistaking comments or strings for URLs. */
export function cssReferences(source: string): string[] {
  const result = transform({
    filename: "site.css",
    code: Buffer.from(source),
    analyzeDependencies: true,
  });
  return (result.dependencies ?? []).flatMap((dependency) =>
    dependency.type === "url" || dependency.type === "import"
      ? [dependency.url]
      : [],
  );
}

/** HTML parsing decodes entities and also covers SVG hrefs and named anchors. */
export function htmlDocument(source: string): LinkDocument {
  const ids = new Set<string>();
  const references: string[] = [];
  let base: string | undefined;

  function visit(node: DefaultTreeAdapterMap["node"]): void {
    if ("attrs" in node) {
      for (const { name, value } of node.attrs) {
        if (name === "id" || (node.tagName === "a" && name === "name")) {
          ids.add(value);
        }
        if (node.tagName === "base" && name === "href") {
          base ??= value;
        } else if (
          ["href", "src", "poster"].includes(name) ||
          (node.tagName === "object" && name === "data")
        ) {
          references.push(value);
        } else if (name === "srcset" || name === "imagesrcset") {
          references.push(
            ...parseSrcset(value, { strict: true }).map(({ url }) => url),
          );
        } else if (name === "style") {
          references.push(...cssReferences(`element { ${value} }`));
        }
      }
      if (node.tagName === "style") {
        references.push(
          ...cssReferences(
            node.childNodes
              .map((child) => ("value" in child ? child.value : ""))
              .join(""),
          ),
        );
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  }

  visit(parse(source));
  return { ids, references, base };
}
