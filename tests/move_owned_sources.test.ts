import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import {
  assertMoveDelivery,
  commitMoveBaseline,
} from "./helpers/move_delivery.js";
import { pathFixture } from "./helpers/path_fixture.js";

for (const change of ["none", "source", "rendered"])
  test(`component moves keep source-only edits out of evidence: change=${change}`, async (t) => {
    const sources = {
      "specs/old/action.mockup.tsx":
        "import {defineComponent} from '@mokly/mokly'; import {label} from './implementation.js'; export const action=defineComponent({title:'Action',description:'An action',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> <button>{label}</button>,variants:[{slug:'default',title:'Default',props:{}}]});",
      "specs/old/implementation.ts": "export const label='Continue';\n",
    };
    const fixture = await pathFixture(sources, '{mockupsDir:"mockups",}');
    t.after(() => fixture.remove());
    await fs.mkdir(path.join(fixture.root, "mockups"));
    const before = await fixture.compile();
    await commitMoveBaseline(await fixture.config(), before);
    await fs.rename(
      path.join(fixture.root, "specs/old"),
      path.join(fixture.root, "specs/new"),
    );
    await fixture.write(
      "specs/new/action.mockup.tsx",
      sources["specs/old/action.mockup.tsx"].replaceAll(
        "specs/old/",
        "specs/new/",
      ),
    );
    if (change !== "none")
      await fixture.write(
        "specs/new/implementation.ts",
        change === "rendered"
          ? "export const label='Submit';\n"
          : sources["specs/old/implementation.ts"] +
              "export const newBehavior=true;\n",
      );
    if (change === "rendered")
      await fixture.write(
        "specs/new/action.mockup.tsx",
        sources["specs/old/action.mockup.tsx"].replace(
          "title:'Action',",
          "title:'Action',movedFrom:'old/action',",
        ),
      );
    const config = await loadConfig(fixture.root),
      after = await compileCatalogue(config);
    await writeCompilation(after, config);
    await assertMoveDelivery(config, after);
    const changed = [
      ...Object.keys(sources),
      ...Object.keys(sources).map((file) => file.replace("/old/", "/new/")),
    ];
    const artifact = await compareReview(
      after,
      config,
      componentGit(before, changed, new Map(Object.entries(sources))),
      "main",
    );
    assert.equal(artifact.pairing?.moves.length, 2);
    const parent = artifact.result.changes.find(
      (change) => change.after?.path === "new/action",
    )!;
    assert.ok(!parent.reasons.some((reason) => reason.kind === "metadata"));
    assert.equal(
      parent.reasons.some((reason) => reason.kind === "dependency"),
      false,
    );
    assert.equal(
      parent.reasons.some((reason) => reason.kind === "material"),
      change === "rendered",
    );
    if (change !== "rendered")
      assert.ok(
        artifact.result.changes.every((change) => change.reasons.length === 0),
      );
  });
