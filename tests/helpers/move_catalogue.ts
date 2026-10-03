import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { generatedBytes } from "../../dist/build/generated_file.js";
import { writeCompilation } from "../../dist/build/transaction.js";

import { componentGit } from "./component_review_fixture.js";
import { pageSource, pathFixture } from "./path_fixture.js";

/** A real compiled directory move with a folder README, document, page and screen variant. */
export async function movedCatalogueFixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  options: {
    edited?: boolean;
    resource?: boolean;
    history?: boolean;
    resourceChanged?: boolean;
    sharedResource?: boolean;
  } = {},
) {
  const fixture = await pathFixture(
    {
      "specs/old/README.md": "# Overview\n\n[Guide](guide.md#start)",
      "specs/old/guide.md":
        "# Guide\n\n## Start\n\nRead the guide." +
        (options.resource ? "\n\n![Diagram](diagram.svg)" : ""),
      "specs/old/diagram.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8"/></svg>',
      "specs/old/page.mockup.ts": pageSource(
        "",
        "<html><body><h1>Page</h1><p>Reference page.</p></body></html>",
      ),
      "specs/old/screen.mockup.tsx": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Screen',description:'A workspace screen',dependencies:[],relatedDocs:[],mobile:<h1>Mobile</h1>,desktop:<h1>Desktop</h1>,variants:[{slug:'detail',title:'Detail',description:'The detail screen',mobile:<h1>Detail mobile</h1>,desktop:<h1>Detail desktop</h1>}]});`,
      ...(options.sharedResource
        ? { "specs/steady.md": "# Steady\n\n![Diagram](old/diagram.svg)" }
        : {}),
    },
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light","dark"]}',
  );
  const cleanups: (() => Promise<void>)[] = [];
  t.after(async () => {
    for (const cleanup of cleanups) await cleanup();
    await fixture.remove();
  });
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const before = await fixture.compile();
  await writeCompilation(before, await fixture.config());
  if (options.history) {
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", "-A");
    git("commit", "-qm", "test: move baseline");
  }
  await fs.rename(
    path.join(fixture.root, "specs/old"),
    path.join(fixture.root, "specs/new"),
  );
  if (options.edited)
    await fixture.write(
      "specs/new/guide.md",
      "# Guide\n\n## Start\n\nRead the updated guide.",
    );
  if (options.resourceChanged || options.sharedResource) {
    const image = await fs.readFile(
      path.join(fixture.root, "specs/new/diagram.svg"),
      "utf8",
    );
    await fixture.write(
      `specs/${options.sharedResource ? "old" : "new"}/diagram.svg`,
      image.replace('r="8"', 'r="7"'),
    );
  }
  const config = await fixture.config();
  const after = await fixture.compile();
  await writeCompilation(after, config);
  const routes = [
    ...new Set([...before.outputs.keys(), ...after.outputs.keys()]),
  ];
  const changedPaths = routes
    .filter((route) => {
      const left = before.outputs.get(route);
      const right = after.outputs.get(route);
      return (
        left === undefined ||
        right === undefined ||
        !Buffer.from(generatedBytes(left)).equals(
          Buffer.from(generatedBytes(right)),
        )
      );
    })
    .map((route) => `mockups/${route}`)
    .sort();
  return {
    ...fixture,
    config,
    before,
    after,
    changedPaths,
    git: componentGit(before, changedPaths),
    beforeRemove: (cleanup: () => Promise<void>) => {
      cleanups.push(cleanup);
    },
  };
}
