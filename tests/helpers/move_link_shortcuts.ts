import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { classificationContext } from "../../dist/review/component_classification_context.js";
import { prepareMoveClassification } from "../../dist/review/moves/prepare.js";
import { reviewViews } from "../../dist/review/views.js";

import { compilationFiles, memoryReader } from "./component_fast_path.js";
import { moveComponentSource } from "./move_catalogue_sources.js";
import { pageSource, pathFixture } from "./path_fixture.js";

/** Compile a stable link whose old page path can become a Markdown document. */
export async function moveLinkShortcutFixture(
  t: TestContext,
  _mode: "committed" | "derived",
  styleEdit: boolean,
  move = true,
  styleLink = false,
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
      "renderer.tsx": renderer("red", styleLink),
    },
    `{mockupsDir:"generated",roots:[{dir:"specs"}],renderer:"./renderer.tsx"}`,
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
  if (styleEdit)
    await fixture.write("renderer.tsx", renderer("blue", styleLink));
  const after = await fixture.compile();
  const input = await prepareMoveClassification({
    before: before.manifest,
    after: after.manifest,
    config: await fixture.config(),
    beforeReader: memoryReader(compilationFiles(before)),
    afterReader: memoryReader(compilationFiles(after)),
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
  });
  const views = (compilation: typeof before) =>
    reviewViews(
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

function renderer(color: string, styleLink: boolean): string {
  return `import {renderToStaticMarkup} from 'react-dom/server';
export default input => '<!doctype html><html><head><style${styleLink ? ' data-nav-href="../target/index.html"' : ""}>.unused{color:${color}}</style></head><body>'.replaceAll('../', '../'.repeat(input.entry.path.split('/').length))+renderToStaticMarkup(input.node)+'</body></html>';`;
}
