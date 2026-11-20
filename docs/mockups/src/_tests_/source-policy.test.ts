import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { interactiveRoleViolations } from "./interactive-role-policy";
import {
  registrationViolations,
  repeatedComponentViolations,
  screenCompositionViolations,
} from "./source-policy";

const root = resolve(import.meta.dirname, "..");

test("screen entries own imported components and flows only reference screens", () => {
  const valid =
    'import { HomeScreen } from "../../screens/home"; defineScreen({ render: (_props, context) => <HomeScreen viewport={context.viewport} /> });';
  assert.deepEqual(
    screenCompositionViolations({ path: "entry.tsx", text: valid }),
    [],
  );
  const variants =
    'import { HomeScreen, HomeEmptyScreen } from "../../screens/home"; const screens = { default: HomeScreen, empty: HomeEmptyScreen }; defineScreen({ props: { state: "default" }, render: ({ state }, context) => { const Screen = screens[state]; return <Screen viewport={context.viewport} />; }, variants: [{ slug: "empty", title: "Empty", props: { state: "empty" } }] });';
  assert.deepEqual(
    screenCompositionViolations({ path: "entry.tsx", text: variants }),
    [],
  );
  for (const [text, message] of [
    [
      valid.replace("<HomeScreen viewport", "<main data-viewport"),
      "screen must be an imported component",
    ],
    [
      valid.replace("render:", "draw:"),
      "screen entry must render one imported screen component",
    ],
    [
      valid.replace(
        "<HomeScreen viewport={context.viewport} />",
        "<main><HomeScreen viewport={context.viewport} /></main>",
      ),
      "screen entry must render one imported screen component",
    ],
    [
      "defineUseCase({ steps: [<HomeScreen />] })",
      "flow cannot own screen markup",
    ],
    [
      variants.replace(
        "empty: HomeEmptyScreen",
        "empty: function LocalScreen() { return null; }",
      ),
      "screen must be an imported component",
    ],
    [
      variants.replace(
        "{ const Screen = screens[state]; return <Screen viewport={context.viewport} />; }",
        'context.viewport === "mobile" ? <HomeScreen /> : <HomeEmptyScreen />',
      ),
      "screen entry must render one imported screen component",
    ],
    [
      variants.replace(/variants: \[.*\] \}\);$/, "variants: states });"),
      "variants must be listed in the entry",
    ],
  ]) {
    assert.ok(
      screenCompositionViolations({ path: "entry.tsx", text }).some(
        (problem) => problem === "entry.tsx: " + message,
      ),
      message,
    );
  }
  const violations = readdirSync(resolve(root, "entries"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((path) => path.endsWith(".mockup.tsx"))
    .flatMap((path) =>
      screenCompositionViolations({
        path,
        text: readFileSync(resolve(root, "entries", path), "utf8"),
      }),
    );
  assert.deepEqual(violations, []);
  const consumers = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(
      (path) =>
        (path.startsWith("screens/") || path.startsWith("components/")) &&
        path.endsWith(".tsx"),
    )
    .map((path) => readFileSync(resolve(root, path), "utf8"))
    .join("\n");
  for (const name of [
    "avatar",
    "button",
    "badge",
    "input",
    "comment-thread",
    "segmented",
    "content-list",
    "selector",
    "options-list",
    "table",
    "panel",
    "settings-dialog",
    "settings-layer",
    "switch",
  ]) {
    assert.ok(
      consumers.includes("/entries/design/" + name + ".mockup"),
      name + " needs a real consumer",
    );
  }
  // Registered, kept and covered by the Design pages while no screen draws it
  // statically: the comment composer's textarea returns with the review phase.
  // The options list's owning screen is the repository step with its select
  // open, and the switch's is the project pane's Automatic builds setting.
  for (const name of ["textarea"]) {
    assert.ok(
      !consumers.includes("/entries/design/" + name + ".mockup"),
      name + " has no owning screen that draws it",
    );
    assert.ok(
      existsSync(resolve(root, "entries/design/" + name + ".mockup.tsx")),
      name + " stays registered",
    );
  }
});

test("repeated registered primitives carry stable instance keys", () => {
  assert.equal(
    repeatedComponentViolations({
      path: "screen.tsx",
      text: "<><Button /><Button /></>",
    }).length,
    2,
  );
  assert.deepEqual(
    repeatedComponentViolations({
      path: "screen.tsx",
      text: '<><Button moklyInstance="start" /><Button moklyInstance="docs" /></>',
    }),
    [],
  );
  const violations = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx"))
    .flatMap((path) =>
      repeatedComponentViolations({
        path,
        text: readFileSync(resolve(root, path), "utf8"),
      }),
    );
  assert.deepEqual(violations, []);
});

test("registrations keep source attribution in their owning entries", () => {
  assert.equal(
    registrationViolations([
      {
        path: "src/entries/design/button.mockup.tsx",
        text: "defineComponent(input)",
      },
    ]).length,
    0,
  );
  assert.equal(
    registrationViolations([
      { path: "src/components/button.tsx", text: "defineComponent(input)" },
    ]).length,
    1,
  );
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx"))
    .map((path) => ({
      path: resolve(root, path),
      text: readFileSync(resolve(root, path), "utf8"),
    }));
  assert.deepEqual(registrationViolations(files), []);
});

test("plain HTML cannot substitute for registered interactive controls", () => {
  for (const text of [
    '<span role="tab">Open</span>',
    '<span role="button link">Open</span>',
    '<div role={active ? "button" : "switch"} />',
    "<span aria-selected={true}>Open</span>",
    "<div tabIndex={0} />",
    "<div tabIndex={1} />",
    '<div role="region" tabIndex={0} />',
    '<div aria-label="Output" tabIndex={0} />',
    '<div role="region" aria-label="Output" tabIndex={order} />',
    "<span onClick={select}>Open</span>",
    "<span role={role} />",
    '<span role={active ? role : "alert"} />',
    '<a role="button">Approve</a>',
  ])
    assert.ok(interactiveRoleViolations({ path: "screen.tsx", text }).length);
  assert.deepEqual(
    interactiveRoleViolations({
      path: "screen.tsx",
      text: '<><Segmented /><section role={error ? "alert" : undefined} /><a href="/">Open</a><iframe src="/stage" tabIndex={-1} title="Stage" /></>',
    }),
    [],
  );
  // A focus target a handler moves focus to, and a named region a keyboard
  // reader focuses to scroll, stay document elements.
  assert.deepEqual(
    interactiveRoleViolations({
      path: "screen.tsx",
      text: '<><h2 tabIndex={-1}>Title</h2><div role="region" aria-labelledby="output" tabIndex={0} /><div role="region" aria-label="Output" tabIndex="0" /></>',
    }),
    [],
  );
  const problems = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(
      (path) =>
        (path.startsWith("screens/") || path.startsWith("components/")) &&
        path.endsWith(".tsx"),
    )
    .flatMap((path) =>
      interactiveRoleViolations({
        path,
        text: readFileSync(resolve(root, path), "utf8"),
      }),
    );
  assert.deepEqual(problems, []);
});
