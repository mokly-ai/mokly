import { componentEntrySource } from "./component_fixture.js";
import { fingerprintRenderer } from "./fingerprint_fixture.js";

export const tagRewriteKinds = ["paired", "renamed", "regions"] as const;

export function fingerprintTagRewriteCase(
  kind: (typeof tagRewriteKinds)[number],
  css = ".entry{color:red}",
) {
  const marker = "<!--mokly-component:start:r-999-->";
  const plain = `<style>${css}</style x="">`;
  const marked = `<style>${css}</style x="${marker}">`;
  if (kind === "regions") {
    const region = (id: string, value: string) =>
      `<!--mokly-review-ignore:start:${id}-->${value}<!--mokly-review-ignore:end:${id}-->`;
    return {
      source: componentEntrySource({ body: "<p>Ordinary</p>" }),
      renderer: {
        before: fingerprintRenderer(
          region("a", plain) + marked + region("b", ""),
        ),
        after: fingerprintRenderer(
          region("a", "") + marked + region("b", plain),
        ),
      },
    };
  }
  const eligible = `<style>{${JSON.stringify(css + "ELIGIBLE")}}</style>`;
  const instance = (key: string) =>
    `<action.Component moklyInstance="${key}" label="Style" />`;
  const source = (body: string) =>
    componentEntrySource({
      actionRender: `() => <style>{${JSON.stringify(css)}}</style>`,
      body,
    });
  const renderer = `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head></head><body>' +
  renderToStaticMarkup(input.node)
    .replaceAll(${JSON.stringify(`<style>${css}ELIGIBLE</style>`)}, ${JSON.stringify(marked)})
    .replaceAll(${JSON.stringify(`<style>${css}</style>`)}, ${JSON.stringify(plain)}) + '</body></html>';`;
  return {
    source: source(eligible + instance("k1")),
    afterSource: source(instance(kind === "renamed" ? "k2" : "k1") + eligible),
    renderer: { before: renderer, after: renderer },
  };
}
