import assert from "node:assert/strict";
import test from "node:test";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const rule = "mokly/no-viewer-intrinsic-elements";
const viewerFile = "packages/viewer/src/shell/new_container.tsx";

async function intrinsicMessages(source: string, filePath = viewerFile) {
  const result = await lintProbe(source, filePath);
  return result.messages
    .filter(({ ruleId }) => ruleId === rule)
    .map(({ message, severity }) => ({ message, severity }));
}

function rejection(name: string) {
  return {
    message: `Render a @mokly/ui component instead of the intrinsic <${name}> element.`,
    severity: 2,
  };
}

test("viewer containers accept fragments, components, and context providers", async () => {
  await requireLintRule(viewerFile, rule);
  for (const source of [
    "export const view = <><Panel /><Other /></>;",
    "export const view = <Foo.Bar />;",
    "export const view = <ui.Panel />;",
    "export const view = <Context.Provider value={null}><Panel /></Context.Provider>;",
    "export const view = <Context value={null}><Panel /></Context>;",
  ])
    assert.deepEqual(await intrinsicMessages(source), [], source);
});

test("viewer containers reject every lower-case HTML and SVG element", async () => {
  for (const [source, names] of [
    ["export const view = <div />;", ["div"]],
    [
      "export const view = <><div><span /></div><p /></>;",
      ["div", "span", "p"],
    ],
    ["export const view = <svg><path d='M0 0' /></svg>;", ["svg", "path"]],
    ["export const view = <custom-element />;", ["custom-element"]],
  ] as const)
    assert.deepEqual(
      await intrinsicMessages(source),
      names.map(rejection),
      source,
    );
});

test("the migration exemption applies only to its exact viewer file", async () => {
  const source = "export const view = <div />;";
  assert.deepEqual(
    await intrinsicMessages(source, "packages/viewer/src/shell/top_bar.tsx"),
    [],
  );
  assert.deepEqual(
    await intrinsicMessages(
      source,
      "packages/viewer/src/shell/nested/top_bar.tsx",
    ),
    [rejection("div")],
  );
});

test("the intrinsic element rule leaves other packages and viewer tests alone", async () => {
  for (const filePath of [
    "packages/ui/src/panel/panel.tsx",
    "packages/viewer/tests/new_container.test.tsx",
    "tests/viewer_fixture.tsx",
  ])
    assert.deepEqual(
      await intrinsicMessages("export const view = <div />;", filePath),
      [],
    );
});
