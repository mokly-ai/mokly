import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

for (const options of [
  { label: "default module resolution", extraConfig: "" },
  {
    label: "consumer-set conditions and mainFields",
    extraConfig:
      'moduleResolution: { conditions: ["react-native", "import", "module", "default"], mainFields: ["module", "main"] },',
  },
])
  test(`CSS @import prefers style export condition and style main field with ${options.label}`, async (t) => {
    const fixture = await styleFixture(
      '@import "pkg-exports"; @import "pkg-main";',
      options,
    );
    t.after(() => removeFixture(fixture));
    for (const [name, manifest, css] of [
      [
        "pkg-exports",
        { exports: { ".": { style: "./style.css", default: "./index.js" } } },
        ".exports{color:red}",
      ],
      [
        "pkg-main",
        { main: "index.js", style: "style.css" },
        ".main{color:blue}",
      ],
    ] as const) {
      const directory = path.join(fixture.root, "node_modules", name);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name, ...manifest }),
      );
      await fs.writeFile(path.join(directory, "style.css"), css);
      await fs.writeFile(
        path.join(directory, "index.js"),
        "export default 42;",
      );
    }
    const compiled = await compileFixture(fixture);
    const output = compiled.outputs.get(entryStyle) as string;
    assert.match(output, /\.exports/);
    assert.match(output, /\.main/);
    assert.ok(output.indexOf(".exports") < output.indexOf(".main"));
    assert.ok(
      !compiled.manifest.sourceFiles.some((source) => source.includes("pkg-")),
    );
  });
