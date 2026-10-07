import assert from "node:assert/strict";
import test from "node:test";

import { parseReviewResult } from "@mokly/viewer/data";

import { compareReview } from "../dist/review/compare.js";

import {
  moveReviewFixture as componentReviewFixture,
  schemeMoveCases,
  stylesheetMoveFixture,
} from "./helpers/move_review_fixture.js";

for (const scenario of schemeMoveCases)
  test(`${scenario.kind} retains ${scenario.change} Dark views: moved=${scenario.moved}, CSS=${Boolean(scenario.stylesheet)}`, async (t) => {
    const fixture = await stylesheetMoveFixture(
      t,
      scenario.kind,
      scenario.destination,
      scenario.stylesheet,
      scenario,
    );
    const results: ReturnType<typeof parseReviewResult>[] = [];
    for (const useFastPath of [false, true])
      await t.test(
        useFastPath ? "fast comparison" : "complete comparison",
        async () => {
          const artifact = await fixture.compare(useFastPath);
          const result = parseReviewResult(artifact.result);
          results.push(result);
          const entry =
            scenario.kind === "screen"
              ? result.screens.find(
                  (entry) => entry.path === scenario.destination,
                )!
              : result.components.find(
                  (entry) => entry.path === scenario.destination,
                )!.variants[0]!;
          assert.equal(entry.state, scenario.change);
          assert.equal(
            entry.previousPath,
            scenario.moved
              ? `old/home${scenario.kind === "component" ? "/default" : ""}`
              : undefined,
          );
          assert.deepEqual(
            entry.views
              .map(({ viewport, colorScheme, state }) => [
                viewport,
                colorScheme,
                state,
              ])
              .sort(),
            ["mobile", "desktop"]
              .flatMap((viewport) => [
                [viewport, "light", "unchanged"],
                [viewport, "dark", scenario.change],
              ])
              .sort(),
          );
          for (const side of ["before", "after"] as const) {
            const routeRoot = `${side === "before" ? "old/home" : scenario.destination}${scenario.kind === "component" ? "/default" : ""}`;
            for (const viewport of ["mobile", "desktop"])
              for (const colorScheme of ["light", "dark"]) {
                const route = `${routeRoot}/index.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`;
                assert.equal(
                  artifact.files.get(`snapshots/${side}/${route}`),
                  fixture[side].outputs.get(route),
                  route,
                );
              }
          }
        },
      );
    assert.equal(results.length, 2);
    assert.deepEqual(results[0], results[1]);
  });

const header = "import {defineComponent} from '@mokly/mokly';";
function component(
  name: string,
  title: string,
  variants: string,
  extraSchema = "",
): string {
  return `defineComponent({path:'${name}',title:'${title}',description:'A control',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{label:{schema:{kind:'string'}}${extraSchema}}},render:(props)=><button>{props.label}</button>,variants:[${variants}]})`;
}
const primary = "{slug:'primary',title:'Primary',props:{label:'Continue'}}";
const secondary = "{slug:'secondary',title:'Secondary',props:{label:'Back'}}";

test("a moved component parent and saved variants retain one comparison each", async (t) => {
  const source = `${header} export default ${component("old/action", "Action", `${primary},${secondary}`)};`;
  const fixture = await componentReviewFixture(
    t,
    (text) => text.replace("old/action", "new/action"),
    source,
  );
  const artifact = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const result = parseReviewResult(artifact.result);
  assert.equal(result.components.length, 1);
  const parent = result.components[0]!;
  assert.equal(parent.previousPath, "old/action");
  assert.deepEqual(
    parent.variants.map((variant) => [
      variant.path,
      variant.previousPath,
      variant.state,
    ]),
    [
      ["new/action/primary", "old/action/primary", "unchanged"],
      ["new/action/secondary", "old/action/secondary", "unchanged"],
    ],
  );
  assert.equal(result.changes.length, 3);
  assert.ok(
    result.changes.every(
      (entry) => entry.previousPath && entry.reasons.length === 0,
    ),
  );
});

test("a variant moved between surviving parents belongs to its current comparison group", async (t) => {
  const before = `${header} export const a = ${component("a", "First", `${primary},${secondary}`)}; export const b = ${component("b", "Second", secondary)};`;
  const after = `${header} export const a = ${component("a", "First", secondary)}; export const b = ${component("b", "Second", `${secondary},${primary.replace("slug:'primary'", "slug:'primary',movedFrom:'a/primary'")}`)};`;
  const fixture = await componentReviewFixture(t, () => after, before);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.deepEqual(
    result.components[0]!.variants.map((variant) => variant.path),
    ["a/secondary"],
  );
  const moved = result.components[1]!.variants.find(
    (variant) => variant.path === "b/primary",
  )!;
  assert.equal(moved.previousPath, "a/primary");
  assert.equal(moved.before?.path, "a/primary");
  assert.equal(moved.after?.path, "b/primary");
  assert.ok(
    !result.changes.some(
      (entry) => entry.before?.path === "a/primary" && !entry.after,
    ),
  );
});

test("a removed parent may have no remaining variants when its variant moved to a new parent", async (t) => {
  const before = `${header} export default ${component("old", "Old", primary)};`;
  const after = `${header} export default ${component("new", "New", primary.replace("slug:'primary'", "slug:'primary',movedFrom:'old/primary'"), ",enabled:{schema:{kind:'boolean'},optional:true}")};`;
  const fixture = await componentReviewFixture(t, () => after, before);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.deepEqual(
    result.components.find((entry) => entry.path === "old")?.variants,
    [],
  );
  assert.equal(
    result.components.find((entry) => entry.path === "old")?.state,
    "removed",
  );
  assert.equal(
    result.components.find((entry) => entry.path === "new")?.variants[0]
      ?.previousPath,
    "old/primary",
  );
  assert.equal(
    result.changes.filter((entry) => entry.previousPath === "old/primary")
      .length,
    1,
  );
});

for (const edited of [false, true])
  test(`a moved component keeps real before/after consumer evidence: edited=${edited}`, async (t) => {
    const source = `${header} import {defineScreen} from '@mokly/mokly';
      export const action = ${component("old/action", "Action", primary)};
      export const consumer = defineScreen({path:'consumer',title:'Consumer',description:'Uses the action',dependencies:[],relatedDocs:[],mobile:<action.Component label='Continue'/>,desktop:<action.Component label='Continue'/>});`;
    const fixture = await componentReviewFixture(
      t,
      (text) => {
        const moved = text.replace("old/action", "new/action");
        return edited
          ? moved.replace(
              "<button>{props.label}</button>",
              "<button>Updated {props.label}</button>",
            )
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
    assert.ok(!result.changes.some((entry) => entry.kind === "screen"));
    if (!edited) {
      assert.deepEqual(result.affectedConsumers, []);
      assert.equal(result.screens[0]!.state, "unchanged");
      return;
    }
    const affected = result.affectedConsumers.find(
      (entry) => entry.consumer.path === "consumer",
    )!;
    assert.equal(affected.changedComponentId, "new/action");
    assert.deepEqual(
      [...new Set(affected.evidence.map((entry) => entry.side))],
      ["before", "after"],
    );
    assert.ok(
      affected.evidence
        .filter((entry) => entry.side === "before")
        .every((entry) => entry.via.at(-1)?.componentId === "old/action"),
    );
    assert.ok(
      affected.evidence
        .filter((entry) => entry.side === "after")
        .every((entry) => entry.via.at(-1)?.componentId === "new/action"),
    );
  });
