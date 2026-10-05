import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { compareReview } from "../dist/review/compare.js";
import { CommittedRepository } from "../dist/review/git.js";

import { commitMoveBaseline } from "./helpers/move_delivery.js";
import { pathFixture } from "./helpers/path_fixture.js";

test("a resource route reused by an unchanged consumer keeps that consumer's CSS edit", async (t) => {
  const fixture = await pathFixture(
    {
      ".gitignore": ".context/\n.review/\n",
      "specs/definitions.tsx": `import {defineScreen} from '@mokly/mokly';
const screen=(path,title)=>defineScreen({path,title,description:title,dependencies:[],relatedDocs:[],mobile:<p className='note'>{title}</p>,desktop:<p className='note'>{title}</p>});
export const invoice=screen('invoice','Invoice'); export const overview=screen('overview','Overview');`,
      "specs/invoice.mockup.ts":
        "import './invoice.css'; export {invoice as default} from './definitions.js';",
      "specs/overview.mockup.ts":
        "import './overview.css'; export {overview as default} from './definitions.js';",
      "specs/invoice.css": ".note { color: red; }",
      "specs/overview.css": ".note { color: blue; }",
    },
    "{mockupsDir:'mockups',roots:[{dir:'specs'}],generatedOutput:'committed'}",
  );
  t.after(fixture.remove);
  await fs.mkdir(path.join(fixture.root, "mockups"));
  const config = await fixture.config();
  await commitMoveBaseline(config, await fixture.compile());
  await fs.unlink(path.join(fixture.root, "specs/invoice.mockup.ts"));
  await fixture.write(
    "specs/overview.mockup.ts",
    "import './invoice.css'; export {invoice,overview} from './definitions.js';",
  );
  const after = await fixture.compile();
  await writeCompilation(after, config);
  const git = new CommittedRepository(new ConfiguredGitCommandRunner(config));
  const { result } = await compareReview(after, config, git, "main");
  assert.equal(
    result.screens.find((record) => record.path === "invoice")?.state,
    "unchanged",
  );
  const overview = result.screens.find((record) => record.path === "overview")!;
  assert.equal(overview.state, "changed");
  assert.ok(
    overview.views.every((view) => view.reasons?.length && !view.material),
  );
});
