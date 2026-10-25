import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

test("import ordering puts every parent depth before siblings and is idempotent", async () => {
  const eslint = new ESLint({ fix: true });
  const input =
    [
      'import "./sibling.js";',
      'import "../../../deep.js";',
      'import "../parent.js";',
      'import "../../middle.js";',
    ]
      .map((line, index) =>
        line.replace('import "', `import value${index} from "`),
      )
      .join("\n") +
    "\nexport const values = [value0, value1, value2, value3];\n";
  const [result] = await eslint.lintText(input, {
    filePath: "packages/viewer/src/client/import_fixture.ts",
  });
  const output = result!.output ?? input;
  assert.equal(result!.errorCount, 0);
  for (const parent of ["../parent", "../../middle", "../../../deep"])
    assert.ok(output.indexOf(parent) < output.indexOf("./sibling"), output);
  const [again] = await eslint.lintText(output, {
    filePath: "packages/viewer/src/client/import_fixture.ts",
  });
  assert.equal(again!.output, undefined);
});
