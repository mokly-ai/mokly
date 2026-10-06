import postcss, {
  type AcceptedPlugin,
  type LazyResult,
  type Processor,
  type Root,
} from "postcss";

/**
 * Parse stylesheet text without reading any input source map.
 *
 * `map: false` stops PostCSS from decoding an inline map or following a
 * `sourceMappingURL` comment to a file, so the tree and every error position
 * depend only on the text, never on a map or the working directory. Insert
 * nodes as objects rather than CSS text: PostCSS parses inserted text without
 * these options.
 */
export function parseStylesheet(css: string, from: string): Root {
  return postcss.parse(css, { from, map: false });
}

/**
 * Run plugins over stylesheet text or a parsed root with no source maps.
 *
 * Text is parsed as `parseStylesheet` parses it, and no output map is built.
 */
export function processStylesheet(
  plugins: readonly AcceptedPlugin[],
  css: string | Root,
  from: string,
): LazyResult<Root> {
  return postcss([...plugins]).process(css, { from, map: false });
}

/** Normalize one plugin value exactly as a PostCSS processor does. */
export function normalizePostcssPlugin(
  plugin: AcceptedPlugin,
): Processor["plugins"] {
  return postcss([plugin]).plugins;
}
