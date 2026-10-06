/** CSS comment that embeds a source map as base64 JSON. */
export function inlineSourceMap(map: string): string {
  return `/*# sourceMappingURL=data:application/json;base64,${Buffer.from(map).toString("base64")} */`;
}

/** Valid JSON that source-map-js rejects as an unsupported map version. */
export const unsupportedSourceMap = JSON.stringify({
  version: 2,
  sources: [],
  names: [],
  mappings: "",
});

/** Map that sends generated line 5 to line 21 of another file. */
export const remappingSourceMap = JSON.stringify({
  version: 3,
  sources: ["original.scss"],
  names: [],
  mappings: ";;;;AAoBA",
});

const outOfRangeSourceMap = JSON.stringify({
  version: 3,
  sections: [
    {
      offset: { line: 10_000_001, column: 0 },
      map: { version: 3, sources: ["a.css"], names: [], mappings: "AAAA" },
    },
  ],
});

/** Inline maps that fail PostCSS whenever it reads input source maps. */
export const brokenInlineSourceMaps = [
  {
    name: "invalid JSON",
    comment: inlineSourceMap("not json"),
    failure: /is not valid JSON/,
  },
  {
    name: "unsupported encoding",
    comment:
      "/*# sourceMappingURL=data:application/json;charset=utf-16;base64,e30= */",
    failure: /Unsupported source map encoding/,
  },
  {
    name: "out-of-range section offset",
    comment: inlineSourceMap(outOfRangeSourceMap),
    failure: /Section offset line must not exceed 10000000/,
  },
] as const;
