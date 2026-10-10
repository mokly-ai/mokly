/** Renderer source that preserves arbitrary marker/CSS bytes through compilation. */
export function fingerprintRenderer(head: string, tail = ""): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ${JSON.stringify(`<!doctype html><html><head>${head}</head><body>`)} + renderToStaticMarkup(input.node) + ${JSON.stringify(`${tail}</body></html>`)};`;
}
