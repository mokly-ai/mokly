import { componentEntrySource } from "./component_fixture.js";

export const occurrenceKinds = [
  "paired-instance",
  "renamed-instance",
  "slot",
  "paired-region",
] as const;

export function fingerprintOccurrenceCase(
  kind: (typeof occurrenceKinds)[number],
  css = ".entry{color:red}",
  splitOwned = false,
) {
  const style = `<style>${css}</style>`;
  const jsx = `<style>{${JSON.stringify(css)}}</style>`;
  if (kind === "paired-region") {
    const region = (id: string, value: string) =>
      `<!--mokly-review-ignore:start:${id}-->${value}<!--mokly-review-ignore:end:${id}-->`;
    return {
      before: region("a", style) + style + region("b", ""),
      after: region("a", "") + style + region("b", style),
      source: componentEntrySource({ body: "<p>Ordinary</p>" }),
    };
  }
  const instance = (key: string) =>
    kind === "slot"
      ? `<pane.Component moklyInstance="${key}">${jsx}</pane.Component>`
      : `<action.Component moklyInstance="${key}" label="Style" />`;
  const source = (body: string) =>
    componentEntrySource({
      actionRender: splitOwned
        ? `() => <style>{${JSON.stringify(css.replace("{", "{<!--mokly-component:start:r-100--><!--mokly-component:end:r-100-->"))}}</style>`
        : `() => ${jsx}`,
      paneRender: "(props) => <>{props.children}</>",
      body,
    });
  return {
    before: "",
    after: "",
    source: source(jsx + instance("k1")),
    afterSource: source(
      instance(kind === "renamed-instance" ? "k2" : "k1") + jsx,
    ),
  };
}
