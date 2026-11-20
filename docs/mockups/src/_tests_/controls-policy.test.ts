import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  controlCssViolations,
  controlSourceViolations,
} from "./controls-policy";

const root = resolve(import.meta.dirname, "../..");

test("controls reject local primitives and ad hoc styling", () => {
  for (const text of [
    "<button>Save</button>",
    "<input />",
    "<textarea />",
    "<select />",
    'import { Caption } from "@firna/ui/typography"; <Caption color="red">Text</Caption>',
    'import { Button } from "@firna/ui/button"; <Button style={{color: "red"}} />',
    'import { Input as Field } from "@firna/ui/input"; <Field inputStyle={{color: "red"}} />',
  ])
    assert.ok(controlSourceViolations({ path: "fixture.tsx", text }).length);
  assert.deepEqual(
    controlSourceViolations({
      path: "fixture.tsx",
      text: 'import { Button } from "@firna/ui/button"; <div className="actions"><Button size="lg" /></div>',
    }),
    [],
  );
  assert.deepEqual(
    controlSourceViolations({
      path: "screens/design/site/parts/search.tsx",
      text: '<button type="button">Search docs</button>',
    }),
    [],
  );
  for (const file of readdirSync(resolve(root, "src"), {
    recursive: true,
    encoding: "utf8",
  }).filter((path) => path.endsWith(".tsx") && !path.startsWith("_tests_/")))
    assert.deepEqual(
      controlSourceViolations({
        path: file,
        text: readFileSync(resolve(root, "src", file), "utf8"),
      }),
      [],
    );
});

test("CSS leaves Firna controls to the theme mapping", () => {
  for (const css of [
    ".button {color:red}",
    ".field input {border:0}",
    ".badge-success {color:red}",
    ".r-abc {color:red}",
    "[data-testid='firna-input'] {color:red}",
  ])
    assert.ok(controlCssViolations(css).length);
  assert.deepEqual(
    controlCssViolations(".field-layout {width:100%} .actions {gap:1rem}"),
    [],
  );
  for (const file of readdirSync(resolve(root, "styles"), {
    recursive: true,
    encoding: "utf8",
  }).filter((path) => path.endsWith(".css")))
    assert.deepEqual(
      controlCssViolations(readFileSync(resolve(root, "styles", file), "utf8")),
      [],
      file,
    );
});
