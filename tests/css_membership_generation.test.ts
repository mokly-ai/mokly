import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { ComponentChangeCache } from "../dist/server/component_change_cache.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { parseReviewResult } from "../packages/viewer/dist/data.js";

import { changedFixture } from "./helpers/changed_fixture.js";

test("selected generations replace own-page CSS facts without evaluating consumer code", async (t) => {
  const source = `import React from "react"; import fs from "node:fs"; import {defineComponent,defineScreen} from "@mokly/mokly";
const counter = process.env.MOKLY_M19_COUNTER;
if (counter) fs.appendFileSync(counter, 'module\\n');
const action = defineComponent({id:'action',title:'Action',description:'Action',relatedDocs:[],propSchema:{kind:'object',properties:{active:{schema:{kind:'boolean'}}}},render:(props)=><b className={props.active?'action':'inactive'}>Action</b>,variants:[{id:'action-default',title:'Default',props:{active:false}}]});
function Consumer(){ if(counter) fs.appendFileSync(counter,'consumer\\n'); return <action.Component active />; }
export const mockups=[action.entries,defineScreen({id:'checkout',title:'Checkout',description:'Checkout',relatedDocs:[],mobile:<Consumer />,desktop:<Consumer />})];`;
  const fixture = await changedFixture(
    t,
    source,
    { extraConfig: 'stylesheets:[{match:"**",stylesheets:["rule.css"]}],' },
    async (item) => {
      await fs.writeFile(
        path.join(item.mockupsDir, "rule.css"),
        ".action{color:red}",
      );
    },
  );
  const counter = path.join(fixture.root, "evaluations.log");
  const previousCounter = process.env.MOKLY_M19_COUNTER;
  process.env.MOKLY_M19_COUNTER = counter;
  fixture.beforeRemove(() => {
    if (previousCounter === undefined) delete process.env.MOKLY_M19_COUNTER;
    else process.env.MOKLY_M19_COUNTER = previousCounter;
  });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "rule.css"),
    ".action{color:blue}",
  );
  let compiled = await compileCatalogue(fixture.config);
  await writeCompilation(compiled, fixture.config);
  const git = committedReviewRepository(fixture.config);
  const commit = await git.evidence.mergeBase("HEAD", "HEAD");
  const cache = new ComponentChangeCache({
    baseline: async () => commit,
    read: () =>
      readCatalogueChanges(
        fixture.config,
        compiled.manifest,
        "HEAD",
        git,
        commit,
        acceptedGenerationFromCompilation(compiled),
      ),
  });
  let count = await fs.readFile(counter, "utf8");
  const first = (await cache.read(1))!;
  assert.deepEqual(first.changedIds, ["checkout"]);
  const server = await startCatalogueServer(fixture.config, {
    base: "HEAD",
    port: 0,
    manifest: compiled.manifest,
    componentRuntime: componentRuntime(compiled),
    componentChanges: first,
    review: configuredServedReview(fixture.config, "HEAD", git),
  });
  fixture.beforeRemove(() => server.close());
  const select = async () => {
    const response = await fetch(
      `${server.url}/__mokly/diffs/review.json?id=checkout`,
    );
    assert.equal(response.status, 200, await response.clone().text());
    return {
      url: response.url,
      result: parseReviewResult(await response.json()),
    };
  };
  const before = await select();
  assert.deepEqual(
    before.result.screens[0]!.views[0]!.reasons![0]!.analysis!.rules[0]!
      .changedComponentIds,
    [],
  );
  assert.equal(await fs.readFile(counter, "utf8"), count);
  await fs.writeFile(
    fixture.entryPath,
    source.replace("props:{active:false}", "props:{active:true}"),
  );
  compiled = await compileCatalogue(fixture.config);
  await writeCompilation(compiled, fixture.config);
  count = await fs.readFile(counter, "utf8");
  cache.invalidate();
  const second = (await cache.read(2))!;
  assert.deepEqual(second.changedIds, ["action", "action-default"]);
  const runtime = componentRuntime(compiled);
  server.replaceComponentRuntime(runtime);
  server.completeCatalogue?.(compiled.manifest, runtime.generation);
  server.publishUpdate({
    componentChanges: second,
    changedIds: second.changedIds,
  });
  const after = await select();
  assert.notEqual(after.url, before.url);
  const analysis = after.result.screens[0]!.views[0]!.reasons![0]!.analysis!;
  assert.deepEqual(analysis.rules[0]!.changedComponentIds, ["action"]);
  assert.equal(analysis.pageEvidence, undefined);
  assert.deepEqual(after.result.screens, second.result!.screens);
  assert.equal(await fs.readFile(counter, "utf8"), count);
});
