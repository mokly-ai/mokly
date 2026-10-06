import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import { generatedBytes } from "../../packages/mokly/dist/build/generated_file.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";

import { pathFixture } from "./path_fixture.js";

type NamedEntryFixtureResult = {
  config: ResolvedConfig;
  before: Compilation;
  after: Compilation;
  root: string;
  write: (name: string, content: string) => Promise<void>;
  remove: () => Promise<void>;
  compile: () => Promise<Compilation>;
};

export const BUILD_NAMES = [
  "coverage",
  "dist",
  "node_modules",
  "README",
] as const;

/** Legal entry identities that overlap names reserved for unrelated filesystem trees. */
export async function namedEntryFixture(
  t: TestContext,
  mode: "committed" | "derived",
): Promise<NamedEntryFixtureResult> {
  const sources: Record<string, string> = {};
  for (const name of BUILD_NAMES) {
    sources[`specs/${name === "README" ? "readme-entry" : name}.mockup.tsx`] =
      screen(name);
    sources[`specs/styles/${name}.css`] =
      `.entry { color: blue; background-image: url('../../assets/${name}/icon.svg'); }`;
    sources[`assets/${name}/icon.svg`] =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="8"/></svg>';
  }
  sources["specs/removed.mockup.tsx"] =
    `import {defineScreen} from '@mokly/mokly'; export default [${BUILD_NAMES.map((name) => `defineScreen({path:'retired/${name}',title:'Retired ${name}',description:'Earlier screen',dependencies:[],relatedDocs:[],mobile:<p>Retired mobile ${name}</p>,desktop:<p>Retired desktop ${name}</p>})`).join(",")}];`;
  sources["specs/pages.mockup.ts"] =
    `import {definePage} from '@mokly/mokly'; export default [${BUILD_NAMES.map((name) => `definePage({path:'guides/${name}',title:'Guide ${name}',description:'Earlier guide',dependencies:[],relatedDocs:[],render:()=>'<html><body>Guide ${name}<img src="../../public.svg" alt="Guide"></body></html>'})`).join(",")}];`;
  const fixture = await pathFixture(
    sources,
    JSON.stringify({
      mockupsDir: "mockups",
      generatedOutput: mode,
      review: {
        outDir: ".review",
        ...(mode === "derived"
          ? { baselineBuild: [["node", "baseline.mjs"]] }
          : {}),
      },
    }),
  );
  t.after(() => fixture.remove());
  await fixture.write(
    "mockups/public.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"><circle r="9"/></svg>',
  );
  for (const name of BUILD_NAMES)
    await fixture.write(`mockups/${name}/private.json`, '{"secret":true}');
  await fixture.write(
    "mockups/dist/unrelated/build.txt",
    "Private build output",
  );
  const config = await fixture.config();
  const before = await fixture.compile();
  if (mode === "committed") await writeCompilation(before, config);
  else {
    await fixture.write(
      "baseline.json",
      JSON.stringify(
        [...before.outputs].map(([route, bytes]) => [
          route,
          Buffer.from(generatedBytes(bytes)).toString("base64"),
        ]),
      ),
    );
    await fixture.write(
      "baseline.mjs",
      `import fs from 'node:fs/promises'; import path from 'node:path'; for(const [route,bytes] of JSON.parse(await fs.readFile('baseline.json','utf8'))){const target=path.join('mockups',route);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(bytes,'base64'));}`,
    );
  }
  await fixture.write(
    ".gitignore",
    `.context/\n.mokly-cache/\n${mode === "derived" ? "mockups/**/*.html\nmockups/mokly-manifest.json\nmockups/mokly-generated/\n" : ""}`,
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", "-A");
  git("commit", "-qm", "test: named output baseline");
  await fs.unlink(path.join(fixture.root, "specs/removed.mockup.tsx"));
  await fs.unlink(path.join(fixture.root, "specs/pages.mockup.ts"));
  for (const name of BUILD_NAMES)
    await fixture.write(
      `specs/${name === "README" ? "readme-entry" : name}.mockup.tsx`,
      screen(name).replaceAll("Before", "Current"),
    );
  const after = await fixture.compile();
  await writeCompilation(after, config);
  return { ...fixture, config: await fixture.config(), before, after };
}

function screen(name: string): string {
  return `import {defineScreen} from '@mokly/mokly'; import './styles/${name}.css'; export default defineScreen({path:'${name}',title:'${name}',description:'A screen',dependencies:[],relatedDocs:[],mobile:<h1 className='entry'>Before mobile ${name}</h1>,desktop:<h1 className='entry'>Before desktop ${name}</h1>});`;
}
