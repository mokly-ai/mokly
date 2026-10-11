/** Mokly's only use of PostCSS's parser and processor; source maps stay off. */
import postcss, {
  type AcceptedPlugin,
  type LazyResult,
  type Processor,
  type Result,
  type Root,
} from "postcss";

/** Parse CSS without loading an inline or sibling source map. */
export function parseCss(css: string, from: string): Root {
  return postcss.parse(css, { from, map: false });
}

/** Run plugins over CSS text without loading or writing a source map. */
export function processCss(
  plugins: readonly AcceptedPlugin[],
  css: string,
  from: string,
): LazyResult {
  return postcss([...plugins]).process(css, { from, map: false });
}

/** Run synchronous plugins over a parsed tree without source maps. */
export function processRootSync(
  plugins: readonly AcceptedPlugin[],
  root: Root,
  from: string,
): Result<Root> {
  return postcss([...plugins])
    .process(root, { from, map: false })
    .sync();
}

/** Expand one accepted plugin into PostCSS's normalized plugin list. */
export function normalizePlugin(plugin: AcceptedPlugin): Processor["plugins"] {
  return postcss([plugin]).plugins;
}
