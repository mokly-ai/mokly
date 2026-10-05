import fs from "node:fs/promises";
import path from "node:path";

import { writeCompilation } from "../../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../../dist/config/git.js";
import { CommittedRepository } from "../../dist/review/git.js";

import { commitMoveBaseline } from "./move_delivery.js";
import { pathFixture } from "./path_fixture.js";

/** Real committed catalogue with imported CSS and optional renderer delivery. */
export async function recordedLocationsFixture(options: {
  kind?: "screen" | "component";
  entryPath?: string;
  variant?: string;
  module?: string;
  renderer?: boolean;
}) {
  const kind = options.kind ?? "screen";
  const module = options.module ?? "specs/invoice.mockup.ts";
  const source = recordedEntrySource(kind, options.entryPath, options.variant);
  const fixture = await pathFixture(
    {
      ".gitignore": ".context/\n.review/\n",
      "specs/definitions.tsx": source,
      "specs/styles.css": ".note { color: blue; }",
      [module]: options.renderer
        ? "export {default} from './definitions.js';"
        : "import './styles.css'; export {default} from './definitions.js';",
      ...(options.renderer
        ? {
            "renderer/render.tsx": rendererSource,
            "renderer/styles.css": ".note { color: blue; }",
            "specs/overview.mockup.tsx": recordedEntrySource(
              "screen",
              "overview",
            ),
          }
        : {}),
    },
    `{mockupsDir:'mockups',roots:[{dir:'specs'}],generatedOutput:'committed',colorSchemes:['light','dark'],${options.renderer ? "renderer:'renderer/render.tsx'," : ""}review:{base:'main',outDir:'.review',sharedImpact:['mockups/mokly-generated/**']}}`,
  );
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const before = await fixture.compile();
  await commitMoveBaseline(await fixture.config(), before);
  return {
    ...fixture,
    before,
    async current() {
      const config = await fixture.config();
      const after = await fixture.compile();
      await writeCompilation(after, config);
      const git = new CommittedRepository(
        new ConfiguredGitCommandRunner(config),
      );
      return { config, after, git };
    },
  };
}

/** Keep definition ownership separate from the module that delivers its CSS. */
export function recordedEntrySource(
  kind: "screen" | "component",
  entryPath?: string,
  variant = "default",
): string {
  const meta = `title:'Invoice',description:'Invoice details',dependencies:[],relatedDocs:[],${entryPath ? `path:${JSON.stringify(entryPath)},` : ""}`;
  return kind === "screen"
    ? `import {defineScreen} from '@mokly/mokly'; export default defineScreen({${meta}mobile:<p className='note'>Invoice</p>,desktop:<p className='note'>Invoice</p>});`
    : `import {defineComponent} from '@mokly/mokly'; export default defineComponent({${meta}propSchema:{kind:'object',properties:{}},render:()=> <button className='note'>Invoice</button>,variants:[{slug:${JSON.stringify(variant)},title:'Default',props:{}}]});`;
}

const rendererSource = `import './styles.css';
import {renderToStaticMarkup} from 'react-dom/server';
export default (input)=> '<!doctype html><html><head>'+input.stylesheets.map(href=>'<link rel="stylesheet" href="'+href+'">').join('')+'</head><body>'+renderToStaticMarkup(input.node)+'</body></html>';`;
