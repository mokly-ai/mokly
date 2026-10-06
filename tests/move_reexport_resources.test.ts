import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import {
  assertMoveDelivery,
  commitMoveBaseline,
} from "./helpers/move_delivery.js";
import { pathFixture } from "./helpers/path_fixture.js";

test("moved entry roots keep imported CSS identity when definitions stay in a helper module", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/shared.tsx":
        "import {defineScreen} from '@mokly/mokly'; export const screen=defineScreen({title:'Screen',description:'Description',dependencies:[],relatedDocs:[],mobile:<p className='note'>Mobile</p>,desktop:<p className='note'>Desktop</p>});",
      "specs/old/screen.mockup.ts":
        "import './styles.css'; export {screen as default} from '../shared.js';",
      "specs/old/styles.css": ".note{color:blue}",
    },
    '{mockupsDir:"mockups",generatedOutput:"committed",review:{sharedImpact:["mockups/mokly-generated/**"]}}',
  );
  t.after(() => fixture.remove());
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const before = await fixture.compile();
  await commitMoveBaseline(await fixture.config(), before);
  await fs.rename(
    path.join(fixture.root, "specs/old"),
    path.join(fixture.root, "specs/new"),
  );
  const after = await fixture.compile(),
    config = await fixture.config();
  await writeCompilation(after, config);
  await assertMoveDelivery(config, after);
  assert.equal(
    before.manifest.entries[0]!.sourcePath,
    after.manifest.entries[0]!.sourcePath,
  );
  const artifact = await compareReview(
    after,
    config,
    componentGit(before),
    "main",
  );
  assert.equal(artifact.pairing?.moves.length, 1);
  assert.deepEqual(artifact.result.changes[0]!.reasons, []);
  assert.equal(artifact.result.screens[0]!.state, "unchanged");
});

test("mapping a moved entry's shared stylesheet does not change a surviving consumer", async (t) => {
  const shared =
    "import {defineScreen} from '@mokly/mokly'; const meta={description:'Description',dependencies:[],relatedDocs:[]}; export const home=defineScreen({...meta,slug:'home',title:'Home',mobile:<p>Home mobile</p>,desktop:<p>Home desktop</p>}); export const detail=defineScreen({...meta,slug:'detail',title:'Detail',mobile:<p>Detail mobile</p>,desktop:<p>Detail desktop</p>});";
  const fixture = await pathFixture(
    {
      "specs/shared.tsx": shared,
      "specs/styles.css": "p { color: blue; }",
      "specs/old/collection.mockup.ts":
        "import '../styles.css'; export {home,detail} from '../shared.js';",
    },
    '{mockupsDir:"mockups",generatedOutput:"committed"}',
  );
  t.after(() => fixture.remove());
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const before = await fixture.compile();
  await commitMoveBaseline(await fixture.config(), before);
  await fixture.write(
    "specs/old/collection.mockup.ts",
    "import '../styles.css'; export {home} from '../shared.js';",
  );
  await fixture.write(
    "specs/new/detail.mockup.ts",
    "import '../styles.css'; export {detail} from '../shared.js';",
  );
  const after = await fixture.compile(),
    config = await fixture.config();
  await writeCompilation(after, config);
  await assertMoveDelivery(config, after);
  const artifact = await compareReview(
    after,
    config,
    componentGit(before),
    "main",
  );
  assert.equal(artifact.pairing?.moves.length, 1);
  assert.ok(
    artifact.result.changes.every((change) => change.reasons.length === 0),
  );
  assert.ok(
    artifact.result.screens.every((screen) => screen.state === "unchanged"),
  );
});

test("a source directory move with an explicit stable path keeps imported CSS unmodified", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/old/screen.mockup.tsx":
        "import './styles.css'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({path:'stable',title:'Screen',description:'Description',dependencies:[],relatedDocs:[],mobile:<p>Mobile</p>,desktop:<p>Desktop</p>});",
      "specs/old/styles.css": "p { color: blue; }",
    },
    '{mockupsDir:"mockups",generatedOutput:"committed"}',
  );
  t.after(() => fixture.remove());
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const before = await fixture.compile();
  await commitMoveBaseline(await fixture.config(), before);
  await fs.rename(
    path.join(fixture.root, "specs/old"),
    path.join(fixture.root, "specs/new"),
  );
  const after = await fixture.compile(),
    config = await fixture.config();
  await writeCompilation(after, config);
  await assertMoveDelivery(config, after);
  const artifact = await compareReview(
    after,
    config,
    componentGit(before),
    "main",
  );
  assert.deepEqual(artifact.pairing?.moves ?? [], []);
  assert.deepEqual(artifact.result.changes, []);
  assert.ok(
    artifact.result.screens.every((screen) => screen.state === "unchanged"),
  );
});
