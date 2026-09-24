import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { generatedHeader } from "../dist/build/ownership.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("committed check separates orphan and unclaimed generated files", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entries: ["**/*.mockup.{ts,tsx}"], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const generated = async (route: string, owner: string) => {
    const target = path.join(config.generatedDir, route);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(
      target,
      `${generatedHeader(owner)}<html></html>\n`,
    );
  };
  await generated("deleted-entry.html", "entries/deleted.mockup.tsx");
  await generated("unclaimed.html", "docs/notes.md");
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.html"),
    "<!doctype html><p>Consumer-authored</p>\n",
  );

  assert.throws(
    () => checkCompilation(compilation, config),
    (error: Error) => {
      assert.match(
        error.message,
        /orphan generated files:[\s\S]*deleted-entry\.html/,
      );
      assert.match(
        error.message,
        /unclaimed generated files:[\s\S]*unclaimed\.html/,
      );
      assert.match(
        error.message,
        /delete them or restore the source under a configured entry glob/i,
      );
      const unclaimed = error.message.split("unclaimed generated files:")[1];
      assert.ok(unclaimed);
      assert.doesNotMatch(unclaimed, /deleted-entry\.html|public\.html/);
      return true;
    },
  );
});

test("committed check tolerates a generated file removed before its header is read", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const disappearing = path.join(config.generatedDir, "disappearing.html");
  await fs.promises.writeFile(
    disappearing,
    `${generatedHeader("docs/notes.md")}<html></html>\n`,
  );
  await fs.promises.writeFile(
    path.join(config.generatedDir, "retained-orphan.html"),
    `${generatedHeader("entries/deleted.mockup.tsx")}<html></html>\n`,
  );
  await fs.promises.writeFile(
    path.join(config.generatedDir, "retained-unclaimed.html"),
    `${generatedHeader("docs/notes.md")}<html></html>\n`,
  );
  const openSync = fs.openSync;
  let opens = 0;
  context.mock.method(
    fs,
    "openSync",
    (candidate: fs.PathLike, flags: fs.OpenMode) => {
      if (candidate === disappearing && ++opens === 2) {
        fs.unlinkSync(disappearing);
      }
      return openSync(candidate, flags);
    },
  );

  assert.throws(
    () => checkCompilation(compilation, config),
    (error: Error) => {
      const groups = [
        ...error.message.matchAll(
          /\n((?:missing|stale|orphan|unclaimed) generated files):/g,
        ),
      ].map((match) => match[1]);
      assert.deepEqual(groups, [
        "orphan generated files",
        "unclaimed generated files",
      ]);
      assert.match(error.message, / {2}- retained-orphan\.html/);
      assert.match(error.message, / {2}- retained-unclaimed\.html/);
      assert.doesNotMatch(error.message, /disappearing\.html/);
      return true;
    },
  );
});
