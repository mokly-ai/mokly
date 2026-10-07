import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";

import { componentEntrySource } from "./component_fixture.js";
import { componentReviewFixture } from "./component_review_fixture.js";
import { commitMoveBaseline } from "./move_delivery.js";
import { pathFixture } from "./path_fixture.js";

/** A compiled move fixture that also validates real reader, Serve and export delivery. */
export function moveReviewFixture(
  t: { after: (fn: () => Promise<void>) => void },
  change: (source: string) => string,
  source = componentEntrySource(),
  extraConfig = 'colorSchemes: ["light", "dark"],',
) {
  return componentReviewFixture(t, change, source, extraConfig, true);
}

/** Move a rendered entry while retaining its declared public stylesheet. */
export async function stylesheetMoveFixture(
  t: { after: (fn: () => Promise<void>) => void },
  kind: "screen" | "component",
  destination: string,
  stylesheet: string,
) {
  const source = (moved: boolean) => {
    const entry = (subject: typeof kind) => {
      if (subject !== kind)
        return `path:'${subject === "screen" ? "checkout" : "action"}',`;
      return moved
        ? `path:${JSON.stringify(destination)},movedFrom:'old/home',`
        : "path:'old/home',";
    };
    return `import {defineComponent,defineScreen} from '@mokly/mokly';
const action=defineComponent({${entry("component")}title:'Action',description:'Action',relatedDocs:[],
 stylesheets:[${JSON.stringify(stylesheet)}],propSchema:{kind:'object',properties:{}},
 render:()=> <button className='action'>Save</button>,variants:[{slug:'default',title:'Default',props:{}}]});
export default [...action.entries,defineScreen({${entry("screen")}title:'Home',description:'Home',relatedDocs:[],
 mobile:<main><action.Component /></main>,desktop:<main><action.Component /></main>})];`;
  };
  const resources = { [stylesheet]: ".action{color:red}" };
  const fixture = await pathFixture({
    ".gitignore": ".mokly-cache/\n.review/\nsite/\n",
    [`generated/${stylesheet}`]: resources[stylesheet]!,
    "specs/entry.mockup.tsx": source(false),
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  const before = await compileCatalogue(config);
  await commitMoveBaseline(config, before);
  await fixture.write("specs/entry.mockup.tsx", source(true));
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  return { ...fixture, config, before, after, resources };
}
