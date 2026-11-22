import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { definitionData } from "../../packages/mokly/src/authoring/runtime.js";
import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { Generation } from "../../packages/mokly/src/sidecar/bundle.js";

import { bundleParams } from "./sidecar.js";

const page = (title: string) =>
  `definePage({title:${JSON.stringify(title)},description:"Page",relatedDocs:[],render:()=>"<p>Page</p>"})`;

export async function describeFixture(context: TestContext): Promise<{
  params: BundleParams;
  revision(stage: number): Promise<void>;
}> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-describe-cache-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = (name: string, source: string) =>
    fs.writeFile(path.join(root, name), source);
  await write(
    "b.mockup.tsx",
    `import {defineComponent} from "@mokly/mokly";
export const Beta=defineComponent({title:"Beta",description:"Control",relatedDocs:[],element:"beta-control",propSchema:{type:"object",additionalProperties:false,properties:{}},props:{},slots:["children"],render:()=> <button>Beta</button>,variants:[{slug:"saved",title:"Saved",props:{},slots:{children:<b>Saved slot</b>}}]});
export {Shared as Duplicate} from "./shared";`,
  );
  await write(
    "button.stories.tsx",
    `const Button=(props:{label:string})=><button>{props.label}</button>;
export default {title:"Controls/Button",component:Button,args:{label:"Story"}};
export const Zulu={args:{label:"Zulu"}};
export const Alpha={args:{label:"Alpha"}};`,
  );
  return {
    params: bundleParams({
      sourceRoot: root,
      entryFiles: ["a.mockup.ts", "b.mockup.tsx"],
      storiesFiles: ["button.stories.tsx"],
      renderer: null,
    }),
    async revision(stage: number) {
      const alpha =
        stage === 3
          ? ""
          : `export const Alpha=${page(stage === 0 || stage === 4 ? "Initial" : "Changed")};`;
      const added =
        stage === 2 || stage === 3
          ? `export const Added=${page("Added")};`
          : "";
      await write(
        "a.mockup.ts",
        `import {definePage} from "@mokly/mokly";
export {Shared as Zed, Shared as Alias} from "./shared";
${alpha}${added}`,
      );
      await write(
        "shared.ts",
        `import {definePage} from "@mokly/mokly";
export const Shared=${page(stage === 0 || stage === 4 ? "Shared" : "Shared update")};`,
      );
    },
  };
}

export function registrationState(generation: Generation) {
  assert.ok(generation.exports);
  return {
    registrations: [...generation.registrations.values()],
    handles: [...generation.handles].map(([handle, value]) => {
      const data = definitionData(value);
      assert.ok(data);
      return [handle, data.kind, data.source, data.input.title];
    }),
    exports: Object.entries(generation.exports.entries).flatMap(
      ([module, values]) =>
        Object.entries(values).map(([name, value]) => [
          module,
          name,
          value !== null && typeof value === "object"
            ? generation.registrations.get(value)
            : undefined,
        ]),
    ),
    savedSlots: [...generation.savedSlots.keys()],
    stories: [...generation.stories.keys()],
  };
}
