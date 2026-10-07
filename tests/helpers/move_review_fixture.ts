import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../../dist/config/git.js";
import { compareReview } from "../../dist/review/compare.js";
import { CommittedRepository } from "../../dist/review/git.js";

import { componentEntrySource } from "./component_fixture.js";
import { componentReviewFixture } from "./component_review_fixture.js";
import { commitMoveBaseline } from "./move_delivery.js";
import { pathFixture } from "./path_fixture.js";

/** Scheme edits and controls, with and without declared CSS. */
export const schemeMoveCases = (["component", "screen"] as const).flatMap(
  (kind) =>
    (["added", "removed", "unchanged"] as const).flatMap((change) =>
      [false, true].flatMap((moved) =>
        !moved && change === "unchanged"
          ? []
          : [undefined, "old/action.css"].map((stylesheet) => ({
              kind,
              change,
              moved,
              stylesheet,
              destination: moved ? "new/deep/home" : "old/home",
              beforeSchemes:
                change === "added"
                  ? (["light"] as const)
                  : (["light", "dark"] as const),
              afterSchemes:
                change === "removed"
                  ? (["light"] as const)
                  : (["light", "dark"] as const),
            })),
      ),
    ),
);

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
  stylesheet: string | undefined,
  schemes?: {
    beforeSchemes: readonly ("light" | "dark")[];
    afterSchemes: readonly ("light" | "dark")[];
  },
) {
  const source = (current: boolean) => {
    const entry = (subject: typeof kind) => {
      const colors = schemes
        ? `colorSchemes:${JSON.stringify(subject === kind ? (current ? schemes.afterSchemes : schemes.beforeSchemes) : ["light", "dark"])},`
        : "";
      if (subject !== kind)
        return `${colors}path:'${subject === "screen" ? "checkout" : "action"}',`;
      return (
        colors +
        (current && destination !== "old/home"
          ? `path:${JSON.stringify(destination)},movedFrom:'old/home',`
          : "path:'old/home',")
      );
    };
    return `import {defineComponent,defineScreen} from '@mokly/mokly';
const action=defineComponent({${entry("component")}title:'Action',description:'Action',relatedDocs:[],
 stylesheets:${JSON.stringify(stylesheet ? [stylesheet] : [])},propSchema:{kind:'object',properties:{}},
 render:()=> <button className='action'>Save</button>,variants:[{slug:'default',title:'Default',props:{}}]});
export default [...action.entries,defineScreen({${entry("screen")}title:'Home',description:'Home',relatedDocs:[],
 mobile:<main><action.Component /></main>,desktop:<main><action.Component /></main>})];`;
  };
  const resources = stylesheet ? { [stylesheet]: ".action{color:red}" } : {};
  const fixture = await pathFixture(
    {
      ".gitignore": ".mokly-cache/\n.review/\nsite/\n",
      ...Object.fromEntries(
        Object.entries(resources).map(([route, css]) => [
          `generated/${route}`,
          css,
        ]),
      ),
      "specs/entry.mockup.tsx": source(false),
    },
    `{mockupsDir:"generated",roots:[{dir:"specs"}],generatedOutput:"committed"${schemes ? ',colorSchemes:["light","dark"]' : ""}}`,
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  const before = await compileCatalogue(config);
  await commitMoveBaseline(config, before);
  await fixture.write("specs/entry.mockup.tsx", source(true));
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const git = new CommittedRepository(new ConfiguredGitCommandRunner(config));
  return {
    ...fixture,
    config,
    before,
    after,
    resources,
    compare: (useFastPath: boolean) =>
      compareReview(after, config, git, "main", undefined, undefined, [], {
        useFastPath,
      }),
  };
}
