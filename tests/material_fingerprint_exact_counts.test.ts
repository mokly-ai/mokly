import assert from "node:assert/strict";
import test from "node:test";

import { runWithComparisonWork } from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { selectedStyleViews } from "./helpers/style_route.js";

const bytes = (text: string) => Buffer.byteLength(text, "utf8");
const fields = [
  "materialBytes",
  "materialNormalizationBytes",
  "inlineFingerprintBytes",
  "inlineFingerprintHashes",
  "fingerprintedViews",
];
for (const mode of ["committed", "derived"] as const)
  for (const kind of ["resolved", "skipped", "owned"] as const)
    test(`exact fingerprint/material accounting for ${kind} in ${mode}`, async (context) => {
      const selector = kind === "owned" ? ".action" : ".entry";
      const css = `${selector}{padding:1px}`;
      const headCss = kind === "skipped" ? css : css.replace("1px", "2px");
      const style = `<style>${css}</style>`;
      const source = componentEntrySource({
        actionRender:
          '(props) => <button className="action">{props.label}</button>',
        body:
          kind === "owned"
            ? '<action.Component moklyInstance="k1" label="é" />'
            : '<p className="entry">é</p>',
      });
      const fixture = await inlineChangesFixture(
        context,
        style,
        `<style>${headCss}</style>`,
        { source, colorSchemes: false },
      );
      const input = await pageFixtureInput(fixture, mode);
      const events: TimingEvent[] = [];
      const prepared = await runWithTimings(
        true,
        "test",
        () =>
          runWithComparisonWork(async () => fingerprintMaterials(input), true),
        { write: (event) => events.push(event) },
      );
      const { before, after } = selectedStyleViews(input);
      const originals = [
        input.beforeFiles.get(before.path)!,
        input.afterFiles.get(after.path)!,
      ].map((value) => Buffer.from(value).toString());
      const headers = originals.map((value) =>
        value.slice(0, value.indexOf("\n") + 1),
      );
      const normalized = comparisonMaterials(prepared);
      const raw = normalized.map((value, index) => headers[index % 2]! + value);
      const constructed = raw.reduce((sum, value) => sum + bytes(value), 0);
      const componentMarkers = originals
        .flatMap((text) => [
          ...text.matchAll(/<!--mokly-component:(?:start|end):r-[0-9]+-->/g),
        ])
        .reduce((sum, match) => sum + bytes(match[0]), 0);
      const projectedAppendices =
        kind === "skipped"
          ? 0
          : 2 * bytes(`<!--mokly-inline-rules:${"x".repeat(43)}-->`);
      const digestInputs =
        kind === "skipped"
          ? [style]
          : kind === "owned"
            ? [css, headCss, ""]
            : [css, headCss];
      // Four pre-ignore materials, two pair calls, two actual single calls; only
      // projected appendices bypass component stripping. Actual markers do not.
      const expected = {
        materialBytes: constructed,
        materialNormalizationBytes:
          2 * constructed +
          bytes(raw[0]!) +
          bytes(raw[1]!) +
          componentMarkers -
          projectedAppendices,
        inlineFingerprintBytes: digestInputs.reduce(
          (sum, value) => sum + bytes(value),
          0,
        ),
        inlineFingerprintHashes: digestInputs.length,
        fingerprintedViews: 1,
      };
      const counts = events.find(
        ({ stage, event }) =>
          stage === "review.material-work" && event === "counts",
      )!.counts!;
      assert.deepEqual(
        Object.fromEntries(fields.map((field) => [field, counts[field]])),
        expected,
      );
      assert.equal(
        prepared.inlineAnalysis?.status,
        kind === "skipped" ? "skipped" : "resolved",
      );
      assert.ok(
        normalized.every((value) => value.includes("<!--mokly-inline-")),
      );
    });
