import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { violationsFor } from "./boundary-imports.mjs";

function check(inputs) {
  const source = {
    "apps/app/package.json": '{"name":"@mokly-cloud/app"}',
    "packages/tokens/package.json": '{"name":"@mokly-cloud/tokens"}',
    ...inputs,
  };
  return violationsFor({
    root: "/repo",
    files: Object.keys(source),
    read: (file) => source[file],
    resolve: (file, specifier) =>
      specifier === "cloud-alias"
        ? "/repo/apps/app/src/api.ts"
        : specifier.startsWith(".") || path.isAbsolute(specifier)
          ? path.resolve("/repo", path.dirname(file), specifier)
          : undefined,
  });
}

test("MIT imports reject cloud package names, relative escapes, and resolved aliases", () => {
  assert.deepEqual(
    check({
      "packages/viewer/src/view.ts": [
        'import "@mokly-cloud/tokens/theme.css";',
        'export { Api } from "../../../apps/app/src/api";',
        'const app = require("cloud-alias");',
        'type Tokens = import("@mokly-cloud/tokens").Tokens;',
        'const lazy = import("../../../apps/app/src/lazy");',
      ].join("\n"),
      "packages/viewer/src/theme.css":
        '@import "@mokly-cloud/tokens/theme.css";',
      "packages/tokens/src/cloud.ts": 'import "@mokly-cloud/app";',
      "apps/app/src/mokly.ts": 'import "@mokly/viewer";',
    }),
    [
      "packages/viewer/src/view.ts: import depends on AGPL source @mokly-cloud/tokens/theme.css",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../../apps/app/src/api",
      "packages/viewer/src/view.ts: import depends on AGPL source cloud-alias",
      "packages/viewer/src/view.ts: import depends on AGPL source @mokly-cloud/tokens",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../../apps/app/src/lazy",
      "packages/viewer/src/theme.css: import depends on AGPL source @mokly-cloud/tokens/theme.css",
    ],
  );
});

test("MIT manifests reject all dependency kinds and aliases while local MIT imports pass", () => {
  assert.deepEqual(
    check({
      "packages/viewer/package.json": JSON.stringify({
        name: "@mokly/viewer",
        dependencies: { "@mokly-cloud/app": "*" },
        devDependencies: { alias: "npm:@mokly-cloud/tokens@1.0.0" },
        peerDependencies: { "@mokly-cloud/tokens": "*" },
        optionalDependencies: {
          local: "file:../../apps/app",
          absolute: "file:/repo/apps/app",
        },
      }),
      "packages/viewer/src/local.ts":
        '// import "@mokly-cloud/app";\nimport "@mokly/ui";',
    }),
    [
      "packages/viewer/package.json: dependencies.@mokly-cloud/app depends on AGPL source *",
      "packages/viewer/package.json: devDependencies.alias depends on AGPL source npm:@mokly-cloud/tokens@1.0.0",
      "packages/viewer/package.json: peerDependencies.@mokly-cloud/tokens depends on AGPL source *",
      "packages/viewer/package.json: optionalDependencies.local depends on AGPL source file:../../apps/app",
      "packages/viewer/package.json: optionalDependencies.absolute depends on AGPL source file:/repo/apps/app",
    ],
  );
});
