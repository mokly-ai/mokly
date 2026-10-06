import assert from "node:assert/strict";
import test from "node:test";

import { scanCssSegments } from "../dist/review/css/segments.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { assertStyleRoute } from "./helpers/style_route.js";
import { styleRouteLargeFixture } from "./helpers/style_route_large.js";

test("seeded single-window edits of real RNW sheets equal the disabled-route and complete oracles", async (context) => {
  const fixture = await styleRouteLargeFixture(context);
  const seed = 0x8c51a7;
  let state = seed;
  const random = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const views = fixture.before.entries.flatMap((entry) =>
    entry.kind === "page"
      ? []
      : generatedViews(entry).map((view) => ({ id: entry.path, view })),
  );
  let routed = 0;
  for (let index = 0; index < 320; index++) {
    const { id, view } = views[random(views.length)]!;
    const original = Buffer.from(
      fixture.beforeFiles.get(view.path)!,
    ).toString();
    const spans = new PageAnalysis(
      original,
      view.path,
      view.usage,
    ).inlineStyles([]);
    const span = spans.find(({ text }) => text.includes(".r-"))!;
    assert.ok(span);
    const scan = scanCssSegments(span.text);
    assert.equal(scan.status, "segmented");
    if (scan.status !== "segmented") return;
    assert.equal(scan.source, span.text);
    const segment = scan.segments[1 + random(scan.segments.length - 1)]!;
    const start = span.contentStart! + segment.start;
    const end = span.contentStart! + segment.end;
    const rule = original.slice(start, end);
    const markerRule = (value: string) => `:root{content:"${value}"}`;
    const ignore =
      "<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->";
    const markedPair = (value: string) => ({
      start,
      end,
      baseText: `${markerRule(value)}:root{color:red}`,
      text: `${markerRule(value)}:root{color:blue}`,
      route: "complete" as const,
    });
    const escaped = (id: number) =>
      String.raw`:root:is([title="\3c !--mokly-component:start:r-${id}-->"],html){color:red}`;
    const candidates: {
      start: number;
      end: number;
      text: string;
      baseText?: string;
      route: "style" | "complete";
    }[] = [
      {
        start,
        end: start,
        text: `.seed-${index}{color:rgb(${random(255)},0,0)}`,
        route: "style",
      },
      { start, end, text: "", route: "style" },
      {
        start,
        end,
        text: rule.replace("{", `{opacity:${random(10) / 10};`),
        route: "style",
      },
      { start, end, text: `/*seed ${index}*/${rule}`, route: "style" },
      { start, end, text: '.seed{content:"\\41 :empty"}', route: "style" },
      { start, end, text: ".seed{", route: "complete" },
      {
        start,
        end,
        baseText: markerRule("<!--mokly-component:start:r-10-->"),
        text: markerRule("<!--mokly-component:start:r-20-->"),
        route: "complete",
      },
      markedPair(ignore),
      markedPair(
        `<!--mokly-review-material:clock:${"a".repeat(64)}-->${ignore}`,
      ),
      {
        start,
        end,
        baseText: escaped(10),
        text: escaped(20),
        route: "complete",
      },
      {
        start,
        end,
        baseText: markerRule("<!--mokly-inline-rules:before-->"),
        text: markerRule("<!--mokly-inline-rules:after-->"),
        route: "complete",
      },
      {
        start,
        end,
        baseText: markerRule("mokly before"),
        text: markerRule("mokly after"),
        route: "style",
      },
    ];
    const edit = candidates[index % candidates.length]!;
    const base =
      edit.baseText === undefined
        ? original
        : original.slice(0, edit.start) +
          edit.baseText +
          original.slice(edit.end);
    const changed =
      original.slice(0, edit.start) + edit.text + original.slice(edit.end);
    for (const mode of ["committed", "derived"] as const) {
      const input = {
        ...fixture,
        after: fixture.before,
        config: { ...fixture.config, generatedOutput: mode },
        beforeFiles: new Map([...fixture.beforeFiles, [view.path, base]]),
        afterFiles: new Map([...fixture.beforeFiles, [view.path, changed]]),
      };
      try {
        const route = edit.route;
        await assertStyleRoute(input, route, id, true, view.path);
        if (route === "style") routed++;
      } catch (cause) {
        throw new Error(
          `seed=${seed} case=${index} mode=${mode} view=${view.path} window=[${edit.start},${edit.end})`,
          { cause },
        );
      }
    }
  }
  assert.ok(routed >= 300, `seed=${seed} routed=${routed}`);
});
