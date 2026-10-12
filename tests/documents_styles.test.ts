import assert from "node:assert/strict";
import test from "node:test";

import { pathFixture } from "./helpers/path_fixture.js";

for (const referenced of [true, false]) {
  test(`nested-root CSS can share only declared document inputs: ${referenced}`, async (t) => {
    const fixture = await pathFixture(
      {
        "generated/specs/guide.md": referenced
          ? "# Guide\n\n![Image](image.svg)"
          : "# Guide",
        "generated/specs/image.svg":
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        "generated/specs/screen.css": 'h1 { background: url("./image.svg"); }',
        "generated/specs/screen.mockup.tsx":
          'import "./screen.css"; import {defineScreen} from "@mokly/mokly"; export default defineScreen({title:"Screen",description:"A styled screen",relatedDocs:[],mobile:<h1>Mobile</h1>,desktop:<h1>Desktop</h1>});',
      },
      '{mockupsDir:"generated",roots:[{dir:"generated/specs"}]}',
    );
    t.after(fixture.remove);
    if (!referenced) {
      await assert.rejects(fixture.compile(), /CSS asset is already public/);
      return;
    }
    const { outputs, manifest } = await fixture.compile();
    assert.ok(manifest.sourceFiles.includes("generated/specs/image.svg"));
    assert.deepEqual(
      outputs.get("image.svg"),
      outputs.get("assets/generated/specs/image.svg"),
    );
    assert.ok(outputs.has("styles/generated/specs/screen.mockup.tsx.css"));
    assert.ok(
      (outputs.get("guide/index.html") as string).includes(
        'src="../image.svg"',
      ),
    );
  });
}
