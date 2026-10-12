import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const exec = promisify(execFile);

for (const mode of ["committed", "derived"] as const)
  test(`style attempts reuse complete preparation without base parsing or projection in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    const style = (color: string) =>
      `<style>.actual-only{color:${color}}.shared{display:block}</style><style>.common{display:block}</style>`;
    const input = withHeadStyles(fixture, style("red"), style("blue"), mode);
    const result = await assertStyleRoute(input, "style");
    assert.deepEqual(result.counts("review.inline-style-analysis"), {
      elements: 4,
      segments: 6,
      segmentHits: 2,
      segmentParses: 4,
      fallbacks: 0,
    });
    const root = await fs.mkdtemp(path.resolve(".context/style-work-"));
    context.after(() => fs.rm(root, { force: true, recursive: true }));
    const filename = path.join(root, "input.json");
    const texts = (files: typeof input.beforeFiles) =>
      [...files].map(([route, source]) => [
        route,
        Buffer.from(source).toString(),
      ]);
    await fs.writeFile(
      filename,
      JSON.stringify({
        ...input,
        beforeFiles: texts(input.beforeFiles),
        afterFiles: texts(input.afterFiles),
      }),
    );
    const { stdout } = await exec(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "tests/helpers/style_route_work_probe.mjs",
      filename,
    ]);
    assert.deepEqual(JSON.parse(stdout), { parses: 1, path: "style" });

    for (const [name, left, right, expected] of [
      [
        "unchanged element failure",
        `${style("red")}<style>.broken{</style>`,
        `${style("blue")}<style>.broken{</style>`,
        {
          elements: 6,
          segments: 6,
          segmentHits: 2,
          segmentParses: 4,
          fallbacks: 2,
        },
      ],
      [
        "child-content predicate",
        style("red").replace(".actual-only", ".actual-only:parent"),
        style("blue").replace(".actual-only", ".actual-only:parent"),
        {
          elements: 4,
          segments: 6,
          segmentHits: 2,
          segmentParses: 4,
          fallbacks: 0,
        },
      ],
    ] as const)
      await context.test(name, async () => {
        const fallback = await assertStyleRoute(
          withHeadStyles(fixture, left, right, mode),
          "complete",
        );
        assert.deepEqual(
          fallback.counts("review.inline-style-analysis"),
          expected,
        );
        assert.equal(
          fallback.counts("review.document-work")["htmlParses.pageAnalysis"],
          2,
        );
      });
  });
