import { componentEntrySource } from "./component_fixture.js";
import {
  fingerprintOccurrenceCase,
  occurrenceKinds,
} from "./fingerprint_occurrence_cases.js";

export const catalogueKinds = [
  "move",
  "raw-reference",
  "style-region",
  "style-signal",
  "tag-region",
  "tag-signal",
  "cross-styles",
  "tag-pair",
  "unfinished",
  "derived-signal",
  "empty-instance",
  "caller-copy",
  "ordinary",
  "parse-failure",
  ...occurrenceKinds,
  "owned-marker-seam",
  "closing-marker-seam",
] as const;
interface Case {
  kind: string;
  before: string;
  after: string;
  guarded: boolean;
  resourceChange?: boolean;
  source?: string;
  afterSource?: string;
}

export function fingerprintSeededCase(
  trial: number,
  random: () => number,
): Case {
  const kind = catalogueKinds[trial % catalogueKinds.length]!;
  const id = `clock-${random() % 16}`;
  const start = `<!--mokly-review-ignore:start:${id}-->`;
  const end = `<!--mokly-review-ignore:end:${id}-->`;
  const key = (random() % 2 ? "a" : "b").repeat(64);
  const signal = `<!--mokly-review-material:${id}:${key}-->`;
  const value = 1 + (random() % 20);
  const css = `.entry{padding:${value}px}`;
  const style = `<style>${css}</style>`;
  const changed = style.replace(`${value}px`, `${value + 1}px`);
  const region = (text: string) => start + text + end;
  const sample: Case = { kind, before: style, after: changed, guarded: false };
  switch (kind) {
    case "closing-marker-seam": {
      const removed =
        "<!--mokly-component:start:r-100--><!--mokly-component:end:r-100-->";
      const copy = `<textarea>${style.replace("</style>", `</style${removed}>`)}</textarea>`;
      sample.before = style + copy + "before";
      sample.after = style + copy + "after";
      sample.guarded = true;
      break;
    }
    case "owned-marker-seam":
      Object.assign(
        sample,
        fingerprintOccurrenceCase("paired-instance", css, true),
        { guarded: true },
      );
      break;
    case "paired-instance":
    case "renamed-instance":
    case "slot":
    case "paired-region":
      Object.assign(sample, fingerprintOccurrenceCase(kind, css), {
        guarded: true,
      });
      break;
    case "move":
      sample.before = style + '<meta name="kept">';
      sample.after = '<meta name="kept">' + style;
      break;
    case "raw-reference":
      sample.before = sample.after =
        random() % 2
          ? `<style>@namespace url(../image.svg);${css}</style>`
          : `<style>.entry:is(url("../image.svg")){padding:${value}px}</style>`;
      sample.guarded = true;
      sample.resourceChange = true;
      break;
    case "style-region":
    case "tag-region": {
      const sheet =
        kind === "style-region"
          ? `<style>${css}/*${start}*/</style>`
          : `<style data-marker="${start}">${css}</style>`;
      sample.before = sheet + `before${end}`;
      sample.after = sheet + `after${end}`;
      sample.guarded = true;
      break;
    }
    case "style-signal":
    case "tag-signal": {
      const sheet =
        kind === "style-signal"
          ? `<style>/*${signal}*/${css}</style>`
          : `<style data-marker="${signal}">${css}</style>`;
      sample.before = sheet + region("before");
      sample.after = sheet + region("after");
      sample.guarded = true;
      break;
    }
    case "cross-styles":
      sample.before = start + style + style + end;
      sample.after = start + changed + style + end;
      break;
    case "tag-pair": {
      const wrap = (sheet: string) =>
        `<style data-ignore="${start}">${sheet}</style data-ignore="${end}">`;
      const material = random() % 2 ? signal : "";
      sample.before = wrap(css) + material;
      sample.after =
        wrap(css.replace(`${value}px`, `${value + 1}px`)) + material;
      sample.guarded = true;
      break;
    }
    case "unfinished":
      sample.before = `<${style}!--mokly-review-ignore:start:${id}`;
      sample.after = `<${changed}!--mokly-review-ignore:start:${id}`;
      sample.guarded = true;
      break;
    case "derived-signal": {
      const join = `join-${random() % 16}`;
      const marker = "<!--mokly-review-material:";
      const cut = 1 + (random() % ("<!--mokly-review-".length - 1));
      const derived =
        marker.slice(0, cut) +
        `<!--mokly-review-ignore:start:${join}-->` +
        marker.slice(cut) +
        `${id}:${key}--><!--mokly-review-ignore:end:${join}-->`;
      sample.before = style + signal + region("same");
      sample.after =
        style + `mokly-in${derived}line-style:D-->` + region("same");
      sample.guarded = true;
      break;
    }
    case "empty-instance":
    case "caller-copy": {
      const fragment =
        'mokly-in<action.Component moklyInstance="empty" label="Empty" />{"line-style:D-->"}';
      const body =
        kind === "caller-copy"
          ? `<pane.Component>${fragment}</pane.Component>`
          : fragment;
      sample.source = componentEntrySource({
        actionRender: "() => null",
        body: `<main className="entry">${body}<p>before</p></main>`,
      });
      sample.afterSource = sample.source.replace(
        "<p>before</p>",
        "<p>after</p>",
      );
      sample.after = style;
      sample.guarded = true;
      break;
    }
    case "ordinary":
      sample.before += region("before");
      sample.after += region("after");
      break;
    case "parse-failure":
      sample.before = style.replace("}</style>", "</style>");
      break;
  }
  return sample;
}
