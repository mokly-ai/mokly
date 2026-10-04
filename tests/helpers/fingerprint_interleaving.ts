import { componentEntrySource } from "./component_fixture.js";
import { fingerprintRenderer } from "./fingerprint_fixture.js";

export const interleavingKinds = [
  "identical",
  "head-tail",
  "head-entry",
  "emotion",
] as const;

export function fingerprintInterleavingCase(
  kind: (typeof interleavingKinds)[number],
) {
  const css = ".entry{color:red}";
  const style = `<style>${css}</style>`;
  const jsx = `<style>{${JSON.stringify(css)}}</style>`;
  const instance = (key: string) =>
    `<action.Component moklyInstance="${key}" label="Style" />`;
  const body =
    kind === "identical"
      ? jsx + instance("k1") + jsx
      : kind === "head-tail"
        ? instance("k1")
        : kind === "head-entry"
          ? instance("k1") + jsx
          : Array.from(
              { length: 4 },
              (_, index) =>
                `<style data-emotion="css-${index}">{${JSON.stringify(`.entry{padding:${index}px}`)}}</style>` +
                instance(`k${index}`),
            ).join("");
  const renderer = fingerprintRenderer(
    kind === "head-tail" || kind === "head-entry" ? style : "",
    kind === "head-tail" ? style : "",
  );
  return {
    source: componentEntrySource({ body }),
    renderer: { before: renderer, after: renderer },
  };
}
