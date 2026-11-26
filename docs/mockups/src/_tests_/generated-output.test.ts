import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { promisify } from "node:util";

import { readCatalogueIndex } from "@mokly/viewer";

import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import {
  checkoutStamp,
  treeStamp,
} from "../../../../apps/mockups/src/_tests_/served-files";

import { indexPath } from "./catalogue-paths";
import {
  outputDirectory,
  outputFixture,
  repository,
  sha256,
} from "./generated-output-fixture";

const screen = "entries/screen.mockup.tsx";

let seed: Awaited<ReturnType<typeof outputFixture>>;
before(async () => {
  seed = await outputFixture();
});
after(() => seed?.cleanup());

/** The fixture screen in the 0.14.0 form, which current validation refuses. */
const earlierScreen =
  "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Screen',description:'Fixture',dependencies:[],relatedDocs:[],mobile:<main>Mobile</main>,desktop:<main>Desktop</main>});\n";

/** The catalogue index of one fixture build, read by the viewer's reader. */
async function builtIndex(root: string, output: string) {
  return readCatalogueIndex(
    JSON.parse(await readFile(path.join(root, output, indexPath), "utf8")),
  );
}

test("a base whose sources fail current validation leaves Changes unavailable and the build still succeeds", async (t) => {
  const fixture = await outputFixture(seed.root);
  t.after(fixture.cleanup);
  const current = await readFile(path.join(fixture.root, screen), "utf8");
  await fixture.write(screen, earlierScreen);
  await fixture.git("add", "-A");
  await fixture.git("commit", "-m", "test: earlier sources");
  await fixture.git("checkout", "-b", "current");
  await fixture.write(screen, current);
  await fixture.git("commit", "-am", "test: current sources");
  const earlier = await fixture.cli(
    "build",
    "--strict",
    "--base",
    "main",
    "--out",
    ".context/earlier",
  );
  assert.match(earlier.stderr, /\[mokly\/build-invalid\]/);
  const unavailable = await builtIndex(fixture.root, ".context/earlier");
  assert.equal(unavailable.changesStatus, "unavailable");
  assert.equal(unavailable.comparisonUrl, null);
  await fixture.git("checkout", "main");
  await fixture.git("merge", "--ff-only", "current");
  await fixture.git("checkout", "-b", "changed");
  await fixture.write(screen, current.replace("</main>", " changed</main>"));
  await fixture.git("commit", "-am", "test: changed screen");
  await fixture.cli(
    "build",
    "--strict",
    "--base",
    "main",
    "--out",
    ".context/current",
  );
  const ready = await builtIndex(fixture.root, ".context/current");
  assert.equal(ready.changesStatus, "ready");
  assert.ok(ready.comparisonUrl);
  assert.ok(
    (
      await stat(
        path.join(fixture.root, ".context/current", ready.comparisonUrl),
      )
    ).isDirectory(),
  );
});

test("mockups:check validates without reading or replacing local output", async (t) => {
  const fixture = await outputFixture(seed.root);
  t.after(fixture.cleanup);
  const manifest = await readFile(
    path.join(repository, "apps/mockups/package.json"),
    "utf8",
  );
  await fixture.write(
    "package.json",
    '{"private":true,"workspaces":["apps/mockups"]}',
  );
  await fixture.write("apps/mockups/package.json", manifest);
  const environment = fixtureGitEnvironment();
  const check = () =>
    promisify(execFile)(
      "npm",
      ["run", "mockups:check", "--workspace", "@mokly-cloud/mockups"],
      { cwd: fixture.root, env: environment },
    );
  const checkout = checkoutStamp(fixture.root, environment);
  await check();
  assert.deepEqual(checkoutStamp(fixture.root, environment), {
    files: checkout.files,
    ignored: [...checkout.ignored, ".context/"].sort(),
  });
  await assert.rejects(readdir(fixture.output), { code: "ENOENT" });
  await cp(path.join(fixture.root, ".context/mockups-check"), fixture.output, {
    recursive: true,
  });
  assert.equal(
    sha256(await readFile(path.join(fixture.output, fixture.generatedFont))),
    sha256(await readFile(fixture.sourceFont)),
  );
  await fixture.write(
    outputDirectory + "/" + fixture.generatedFont,
    "Corrupt local font\n",
  );
  await fixture.write(outputDirectory + "/extra.html", "Extra local output\n");
  const local = treeStamp(fixture.output);
  await check();
  assert.deepEqual(treeStamp(fixture.output), local);
});
