/** Run the shipped determinism command over a real build of a fixture with the pinned Mokly CLI. */

import { execFile } from "node:child_process";
import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";

import { indexPath, screenView } from "./catalogue-paths";
import {
  outputDirectory,
  outputFixture,
  repository,
} from "./generated-output-fixture";

/** The fixture document that the stand-in build marks. */
export const markedDocument = screenView("screen", "desktop");

/**
 * The fixture with the shipped `package.json` scripts and determinism
 * scripts. Its `mockups:build` installs a copy of one real build and marks one
 * document, with the build process id when `drift` is set, and records each
 * call in `build-calls`. The policy and browser scripts throw when they load.
 */
export async function determinismCommandFixture(drift = false) {
  const fixture = await outputFixture();
  await fixture.cli("build", "--strict", "--no-changes");
  const seed = path.join(fixture.root, ".context/seed");
  await cp(fixture.output, seed, { recursive: true });
  const index: Record<string, unknown> = JSON.parse(
    await readFile(path.join(seed, indexPath), "utf8"),
  );
  const original: { scripts: Record<string, string> } = JSON.parse(
    await readFile(path.join(repository, "apps/mockups/package.json"), "utf8"),
  );
  original.scripts["mockups:build"] = "node ../../fixture-build.mjs";
  original.scripts["test:policy"] = "node -e \"throw Error('policy loaded')\"";
  original.scripts["test:browser"] =
    "node -e \"throw Error('browser loaded')\"";
  await fixture.write(
    "package.json",
    '{"type":"module","private":true,"workspaces":["apps/mockups"]}',
  );
  await fixture.write("apps/mockups/package.json", JSON.stringify(original));
  for (const file of ["check-determinism.mjs", "determinism.mjs"])
    await fixture.write(
      "apps/mockups/scripts/" + file,
      await readFile(
        path.join(repository, "apps/mockups/scripts", file),
        "utf8",
      ),
    );
  await fixture.write(
    "fixture-build.mjs",
    `import {appendFile,cp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=import.meta.dirname;
const output=path.join(root,${JSON.stringify(outputDirectory)});
await rm(output,{force:true,recursive:true});
await cp(path.join(root,'.context/seed'),output,{recursive:true});
const document=path.join(output,${JSON.stringify(markedDocument)});
await writeFile(document,(await readFile(document,'utf8'))+'<!--build '+${drift ? "process.pid" : "'stable'"}+'-->');
await appendFile(path.join(root,'build-calls'),'build\\n');
`,
  );
  const run = (script: string) =>
    promisify(execFile)(
      "npm",
      ["run", script, "--workspace", "@mokly-cloud/mockups"],
      { cwd: fixture.root, env: fixtureGitEnvironment() },
    );
  return { ...fixture, index, run };
}
