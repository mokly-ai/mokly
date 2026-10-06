import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { generatedViews } from "@mokly/viewer/data";

import { classificationContext } from "../../dist/review/component_classification_context.js";
import { prepareMoveClassification } from "../../dist/review/moves/prepare.js";

import { memoryReader } from "./component_fast_path.js";
import { moveComponentSource } from "./move_catalogue_sources.js";
import { pageSource, pathFixture } from "./path_fixture.js";

/** Compile a stable link whose old page path can become a Markdown document. */
export async function moveLinkShortcutFixture(
  t: TestContext,
  mode: "committed" | "derived",
  styleEdit: boolean,
  move = true,
) {
  const fixture = await pathFixture(
    {
      "specs/target.mockup.ts": pageSource(
        "",
        "<html><body>Target</body></html>",
      ),
      "specs/action.mockup.tsx": moveComponentSource(),
      "specs/guide.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly';
export default defineScreen({title:'Guide',description:'Guide',dependencies:[],relatedDocs:[],desktop:<MockLink to="target">Target</MockLink>,mobile:<MockLink to="target">Target</MockLink>});`,
      "renderer.tsx": renderer("red"),
    },
    `{mockupsDir:"generated",roots:[{dir:"specs"}],renderer:"./renderer.tsx",generatedOutput:${JSON.stringify(mode)}}`,
  );
  t.after(fixture.remove);
  const before = await fixture.compile();
  if (move) {
    await fs.rename(
      path.join(fixture.root, "specs/target.mockup.ts"),
      path.join(fixture.root, "specs/moved.mockup.ts"),
    );
    await fixture.write("specs/target.md", "# Target\n\nA new document.");
  }
  if (styleEdit) await fixture.write("renderer.tsx", renderer("blue"));
  const after = await fixture.compile();
  const input = await prepareMoveClassification({
    before: before.manifest,
    after: after.manifest,
    config: await fixture.config(),
    beforeReader: memoryReader(before.outputs),
    afterReader: memoryReader(after.outputs),
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
  });
  const views = (compilation: typeof before) =>
    generatedViews(
      compilation.manifest.entries.find((entry) => entry.path === "guide")!,
    );
  return {
    before,
    after,
    input,
    beforeViews: views(before),
    afterViews: views(after),
    context: async () =>
      (await classificationContext(input, input.before, input.after)).context,
  };
}

function renderer(color: string): string {
  return `import {renderToStaticMarkup} from 'react-dom/server';
export default input => '<!doctype html><html><head><style>.unused{color:${color}}</style></head><body>'+renderToStaticMarkup(input.node)+'</body></html>';`;
}
