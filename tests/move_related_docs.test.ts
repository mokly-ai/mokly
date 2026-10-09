import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import {
  assertMoveDelivery,
  commitMoveBaseline,
} from "./helpers/move_delivery.js";
import { pathFixture } from "./helpers/path_fixture.js";

for (const components of [false, true])
  test(`relatedDocs follows a paired document without changing its owner: components=${components}`, async (t) => {
    const source = `import {definePage,defineScreen,defineComponent} from '@mokly/mokly';
      const common={title:'Reference',description:'Read the guide',relatedDocs:['specs/old.md']};
      export const page=definePage({...common,slug:'page',render:()=>'<html><body>Reference</body></html>'});
      export const screen=defineScreen({...common,slug:'screen',mobile:<h1>Reference</h1>,desktop:<h1>Reference</h1>});
      ${components ? "export const control=defineComponent({...common,slug:'control',propSchema:{kind:'object',properties:{}},render:()=> 'Control',variants:[{slug:'default',title:'Default',props:{}}]});" : ""}`;
    const fixture = await pathFixture(
      {
        "specs/old.md": "# Guide\n\nRead this guide.",
        "specs/links.mockup.tsx": source,
      },
      '{mockupsDir:"mockups",roots:[{dir:"specs"}],}',
    );
    t.after(fixture.remove);
    await fs.mkdir(path.join(fixture.root, "mockups"));
    const config = await fixture.config();
    const before = await fixture.compile();
    await commitMoveBaseline(await fixture.config(), before);
    await fs.rename(
      path.join(fixture.root, "specs/old.md"),
      path.join(fixture.root, "specs/new.md"),
    );
    await fixture.write(
      "specs/links.mockup.tsx",
      source.replaceAll("specs/old.md", "specs/new.md"),
    );
    const after = await fixture.compile();
    await writeCompilation(after, config);
    await assertMoveDelivery(config, after);
    const git = componentGit(before);
    const snapshot = await computeCatalogueChanges(
      config,
      "main",
      git,
      after.manifest,
    );
    assert.deepEqual(snapshot.movedEntries, [
      { path: "new", previousPath: "old" },
    ]);
    assert.deepEqual(snapshot.componentChanges?.changedEntries, []);
    const review = await compareReview(after, config, git, "main");
    assert.deepEqual(review.result.changes, []);
  });
