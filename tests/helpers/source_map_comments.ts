/** Source-map annotations that must never change a stylesheet build. */

/** Encode a source map as a base64 inline annotation URL. */
export function inlineSourceMap(map: object): string {
  const encoded = Buffer.from(JSON.stringify(map)).toString("base64");
  return `data:application/json;base64,${encoded}`;
}

/** Append a source-map annotation comment to CSS text. */
export function withSourceMap(css: string, url: string): string {
  return `${css}\n/*# sourceMappingURL=${url} */`;
}

/** Inline map whose JSON does not parse. */
export const brokenInlineMap = "data:application/json;base64,bm90IGpzb24=";

/** Inline map with an encoding that PostCSS cannot decode. */
export const unsupportedEncodingMap = "data:application/json;charset=latin1,{}";

/** Indexed inline map whose section offset source-map-js 1.2.2 rejects. */
export const oversizedIndexedMap = inlineSourceMap({
  version: 3,
  sections: [
    {
      offset: { line: 10_000_001, column: 0 },
      map: { version: 3, sources: [], names: [], mappings: "" },
    },
  ],
});

/** Sibling map file contents with a version that source-map-js rejects. */
export const unsupportedSiblingMap =
  '{"version":2,"sources":[],"names":[],"mappings":""}';
