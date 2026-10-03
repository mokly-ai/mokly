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
const escaped = (id: number) =>
  String.raw`<style id="edited">.entry:is([title="\3c !--mokly-component:start:r-${id}-->"],main){color:red}</style>`;

for (const mode of ["committed", "derived"] as const)
  test(`fall-through reuses safe diff attribution and rematches unchanged references in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    const root = await fs.mkdtemp(path.resolve(".context/style-attribution-"));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    for (const references of [false, true]) {
      const reference = references
        ? '<style>style#edited:contains("r-10"){background:url("../asset.svg")}</style>'
        : "";
      const base = withHeadStyles(
        fixture,
        escaped(10) + reference,
        escaped(20) + reference,
        mode,
      );
      const input = {
        ...base,
        beforeFiles: new Map([...base.beforeFiles, ["asset.svg", "before"]]),
        afterFiles: new Map([
          ...base.afterFiles,
          ["asset.svg", references ? "after" : "before"],
        ]),
        changedPaths: references ? ["mockups/asset.svg"] : [],
      };
      const result = await assertStyleRoute(input, "complete");
      if (references)
        assert.deepEqual(result.comparison.view.reasons, [
          { kind: "dependency", path: "mockups/asset.svg" },
        ]);
      assert.deepEqual(result.counts("review.inline-style-analysis"), {
        elements: references ? 4 : 2,
        segments: references ? 4 : 2,
        segmentParses: references ? 3 : 2,
        segmentHits: references ? 1 : 0,
        fallbacks: 0,
      });
      const filename = path.join(root, `${references}.json`);
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
        "tests/helpers/style_route_attribution_probe.mjs",
        filename,
      ]);
      assert.deepEqual(JSON.parse(stdout), {
        changed: 2,
        unchanged: references ? 2 : 0,
      });
    }
  });
