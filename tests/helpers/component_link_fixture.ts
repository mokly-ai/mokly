import fs from "node:fs/promises";
import path from "node:path";

import { membershipSource } from "./css_membership_fixture.js";
import type { TestFixture } from "./fixture.js";

export const linkSource = membershipSource.replace(
  'path: "action",',
  'path: "action", stylesheets: ["action.css"],',
);

export const configuredLinks =
  'input.stylesheets.map((href) => \'<link rel="stylesheet" href="\' + href + \'">\').join("")';

export function linkRenderer(head: string, body = "''"): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head><title>Links</title>' + ${head} + '</head><body>' + ${body} + renderToStaticMarkup(input.node) + '</body></html>';`;
}

export async function prepareLinkFixture(
  fixture: TestFixture,
  renderer: string,
) {
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    ".action{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "base.css"),
    ".heading{color:red}",
  );
}

export const ignoredLinksRenderer = linkRenderer(
  `'<!--mokly-review-ignore:start:assets-->' + ${configuredLinks} + '<style>.author{color:red}</style><!--mokly-review-ignore:end:assets-->'`,
  `'<div><!--mokly-review-ignore:start:author--><p class="ignored">Ignored author</p><!--mokly-review-ignore:end:author--></div>'`,
);
