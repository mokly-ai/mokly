import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentInlineMaterial } from "../dist/components/comparison_projection.js";
import { hasFingerprintSeam } from "../dist/review/page_fingerprint_guard.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { assertGuardModel } from "./helpers/fingerprint_model_oracle.js";
import {
  modelKinds,
  modelSources,
} from "./helpers/fingerprint_model_sources.js";
import { fingerprintRandom } from "./helpers/fingerprint_random.js";
import {
  selectedStyleViews,
  styleRouteFixture,
} from "./helpers/style_route.js";

const seed = 0x9f71ab;
test("seeded guard admission matches full recipe rendering and the real normalizer", async (context) => {
  const fixture = await styleRouteFixture(
    context,
    (source) => source,
    componentEntrySource({
      actionRender: "() => null",
      paneRender: "(props) => <section>{props.children}</section>",
      body: '<main className="entry">LEFT<action.Component moklyInstance="empty" label="Empty" />RIGHT<pane.Component>CALLER</pane.Component></main>',
    }),
  );
  const { before, after } = selectedStyleViews(fixture);
  const template = Buffer.from(
    fixture.beforeFiles.get(before.path)!,
  ).toString();
  const random = fingerprintRandom(seed);
  const openers = new Set<string>();
  context.diagnostic(`seed=0x${seed.toString(16)}`);
  const outcomes = new Map<
    string,
    { admitted: number; guarded: number; invalid: number }
  >();
  for (let trial = 0; trial < 20_000; trial++) {
    const source = modelSources(template, trial, random);
    openers.add(source.opener);
    const count = outcomes.get(source.kind) ?? {
      admitted: 0,
      guarded: 0,
      invalid: 0,
    };
    outcomes.set(source.kind, count);
    const label = `seed=0x${seed.toString(16)} trial=${trial} kind=${source.kind}`;
    const pages = new PageAnalysisPair(
      before,
      after,
      source.before,
      source.after,
    );
    let inline: ComponentInlineMaterial;
    try {
      const side = (which: "before" | "after") => {
        const page =
          which === "before" ? pages.beforeAnalysis : pages.afterAnalysis;
        const spans = page.inlineStyles(pages.pairedIgnoreIds);
        const material = source.skipped
          ? { replacements: [], appendix: "" }
          : {
              replacements: spans.map(({ start, end }) => ({
                start,
                end,
                text: "",
              })),
              appendix: `<style>${spans.map(({ text }) => text).join("")}</style>`,
            };
        return { actual: material, projected: material };
      };
      inline = { before: side("before"), after: side("after") };
    } catch (error) {
      assert.ok(error instanceof Error, label);
      assert.match(
        error.message,
        /^\[mokly\/(?:components|review-ignore)\]/,
        label,
      );
      count.invalid++;
      continue;
    }
    if (hasFingerprintSeam(pages, inline)) count.guarded++;
    else {
      count.admitted++;
      try {
        assertGuardModel(pages, inline, label);
      } catch (error) {
        throw new Error(label, { cause: error });
      }
    }
  }
  assert.deepEqual([...openers].sort(), [
    "<!--mokly-component:",
    "<!--mokly-review-",
  ]);
  assert.deepEqual([...outcomes.keys()].sort(), [...modelKinds].sort());
  assert.ok(
    outcomes.get("plain")!.admitted > 1000,
    `seed=${seed}: positive admission control`,
  );
  for (const kind of modelKinds.filter((kind) => kind !== "plain"))
    assert.ok(
      outcomes.get(kind)!.guarded > 0,
      `seed=${seed}: ${kind} exercised`,
    );
  context.diagnostic(
    `seed=0x${seed.toString(16)} ${JSON.stringify(Object.fromEntries(outcomes))}`,
  );
});
