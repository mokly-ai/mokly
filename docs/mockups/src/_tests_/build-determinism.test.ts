import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { checkBuildDeterminism } from "../../../../apps/mockups/scripts/determinism.mjs";

import { indexPath, screenView } from "./catalogue-paths";
import { outputFixture } from "./generated-output-fixture";
import { policyFixture } from "./policy-fixture";

const document = screenView("screen", "desktop");

/** One real strict build of the fixture catalogue, and a snapshot parent. */
async function sampleTree() {
  const fixture = await outputFixture();
  await fixture.cli("build", "--strict", "--no-changes");
  return {
    ...fixture,
    snapshots: path.join(fixture.root, ".context/snapshots"),
  };
}

test("independent identical builds pass and only the owned snapshot is removed", async (t) => {
  const fixture = await sampleTree();
  t.after(fixture.cleanup);
  await mkdir(fixture.snapshots, { recursive: true });
  await writeFile(path.join(fixture.snapshots, "keep.txt"), "Unrelated\n");
  const built = await readFile(path.join(fixture.output, document));
  let rebuilds = 0;
  await checkBuildDeterminism({
    output: fixture.output,
    snapshots: fixture.snapshots,
    rebuild: async () => {
      rebuilds++;
    },
  });
  assert.equal(rebuilds, 1);
  assert.deepEqual(await readdir(fixture.snapshots), ["keep.txt"]);
  assert.deepEqual(await readFile(path.join(fixture.output, document)), built);
});

test("index, document, binary and membership drift list the differing paths", async (t) => {
  const fixture = await sampleTree();
  t.after(fixture.cleanup);
  await assert.rejects(
    checkBuildDeterminism({
      output: fixture.output,
      snapshots: fixture.snapshots,
      rebuild: async () => {
        await writeFile(path.join(fixture.output, indexPath), "changed\n");
        // One byte of the font changes, and its size stays the same.
        const font = path.join(fixture.output, fixture.generatedFont);
        const bytes = await readFile(font);
        bytes[0] ^= 1;
        await writeFile(font, bytes);
        await rm(path.join(fixture.output, document));
        // The walk meets `extra/extra.html` before `extra.html`, so only a
        // sort lists them in path order.
        await mkdir(path.join(fixture.output, "extra"));
        await writeFile(path.join(fixture.output, "extra/extra.html"), "x\n");
        await writeFile(path.join(fixture.output, "extra.html"), "extra\n");
      },
    }),
    (error: Error) => {
      assert.ok(
        error.message.includes("missing:\n  " + document + "\n"),
        error.message,
      );
      assert.ok(
        error.message.includes("extra:\n  extra.html\n  extra/extra.html\n"),
        error.message,
      );
      assert.ok(
        error.message.includes(
          "changed:\n  " + indexPath + "\n  " + fixture.generatedFont + "\n",
        ),
        error.message,
      );
      return true;
    },
  );
  assert.deepEqual(await readdir(fixture.snapshots), []);
});

test("missing output gives the root build command before any rebuild", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  let rebuilds = 0;
  await assert.rejects(
    checkBuildDeterminism({
      output: path.join(fixture.root, "missing"),
      snapshots: path.join(fixture.root, ".context/snapshots"),
      rebuild: async () => {
        rebuilds++;
      },
    }),
    /Mockup output is missing\. Run npm run mockups:build from the repository root\./,
  );
  assert.equal(rebuilds, 0);
});

test("a failed second compilation fails the guard and cleans its copy", async (t) => {
  const fixture = await sampleTree();
  t.after(fixture.cleanup);
  await assert.rejects(
    checkBuildDeterminism({
      output: fixture.output,
      snapshots: fixture.snapshots,
      rebuild: async () => {
        throw new Error("Build rejected");
      },
    }),
    /Build rejected/,
  );
  assert.deepEqual(await readdir(fixture.snapshots), []);
});

test("a real renderer with process-dependent output fails independent compilation", async (t) => {
  const fixture = await outputFixture();
  t.after(fixture.cleanup);
  await fixture.write(
    "entries/screen.mockup.tsx",
    "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Screen',description:'Fixture',relatedDocs:[],render:()=><main>{process.pid}</main>});\n",
  );
  await fixture.cli("build", "--strict", "--no-changes");
  await assert.rejects(
    checkBuildDeterminism({
      output: fixture.output,
      snapshots: path.join(fixture.root, ".context/snapshots"),
      rebuild: async () => {
        await fixture.cli("build", "--strict", "--no-changes");
      },
    }),
    (error: Error) => {
      assert.match(
        error.message,
        /^Independent mockup builds differ:\nchanged:/,
      );
      assert.ok(
        error.message.includes("\n  " + document + "\n"),
        error.message,
      );
      return true;
    },
  );
});
