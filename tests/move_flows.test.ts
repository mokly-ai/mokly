import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

const source = `import {defineScreen,defineUseCase} from '@mokly/mokly';
  const common={description:'A journey',dependencies:[],relatedDocs:[]};
  export const screen=defineScreen({...common,path:'old/screen',title:'Screen',useCasePaths:['old/flow'],mobile:<h1>Screen</h1>,desktop:<h1>Screen</h1>});
  export const flow=defineUseCase({...common,path:'old/flow',title:'Flow',steps:[{screenPath:'old/screen',title:'Start',description:'Open the screen'}]});`;

for (const edited of [false, true])
  test(`moved flow references use current paired paths without duplicate propagation: edited=${edited}`, async (t) => {
    const fixture = await componentReviewFixture(
      t,
      (text) => {
        const moved = text.replaceAll("old/", "new/");
        return edited
          ? moved.replaceAll("<h1>Screen</h1>", "<h1>Updated screen</h1>")
          : moved;
      },
      source,
    );
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    const flow = result.changes.find((entry) => entry.kind === "use-case")!;
    assert.equal(flow.previousPath, "old/flow");
    assert.deepEqual(
      flow.reasons,
      edited ? [{ kind: "screen", screenPath: "new/screen" }] : [],
    );
    assert.equal(result.screens[0]!.previousPath, "old/screen");
  });
