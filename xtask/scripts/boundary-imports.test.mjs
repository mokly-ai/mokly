import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { violationsFor } from "./boundary-imports.mjs";

function check(inputs) {
  const source = {
    "packages/app/package.json": '{"name":"@mokly-cloud/app"}',
    "packages/desktop/package.json": '{"name":"@mokly-cloud/desktop"}',
    "packages/tokens/package.json": '{"name":"@mokly-cloud/tokens"}',
    "apps/site/package.json": '{"name":"@mokly-cloud/site"}',
    ...inputs,
  };
  return violationsFor({
    root: "/repo",
    files: Object.keys(source),
    read: (file) => source[file],
    resolve: (file, specifier) =>
      specifier === "cloud-alias"
        ? "/repo/packages/app/src/api.ts"
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
        'export { Api } from "../../../packages/app/src/api";',
        'const app = require("cloud-alias");',
        'type Tokens = import("@mokly-cloud/tokens").Tokens;',
        'const lazy = import("../../../packages/app/src/lazy");',
        'import "../../desktop/src/main";',
        'import "@mokly-cloud/site";',
        'import "../../../apps/worker/src/index";',
      ].join("\n"),
      "packages/viewer/src/theme.css":
        '@import "@mokly-cloud/tokens/theme.css";',
      "packages/tokens/src/cloud.ts": 'import "@mokly-cloud/app";',
      "packages/app/src/mokly.ts": 'import "@mokly/viewer";',
      "packages/desktop/src/main.ts": 'import "../../app/src/api";',
    }),
    [
      "packages/viewer/src/view.ts: import depends on AGPL source @mokly-cloud/tokens/theme.css",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../../packages/app/src/api",
      "packages/viewer/src/view.ts: import depends on AGPL source cloud-alias",
      "packages/viewer/src/view.ts: import depends on AGPL source @mokly-cloud/tokens",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../../packages/app/src/lazy",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../desktop/src/main",
      "packages/viewer/src/view.ts: import depends on AGPL source @mokly-cloud/site",
      "packages/viewer/src/view.ts: import depends on AGPL source ../../../apps/worker/src/index",
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
          local: "file:../../packages/app",
          absolute: "file:/repo/packages/app",
        },
      }),
      "packages/viewer/src/local.ts":
        '// import "@mokly-cloud/app";\nimport "@mokly/ui";',
    }),
    [
      "packages/viewer/package.json: dependencies.@mokly-cloud/app depends on AGPL source *",
      "packages/viewer/package.json: devDependencies.alias depends on AGPL source npm:@mokly-cloud/tokens@1.0.0",
      "packages/viewer/package.json: peerDependencies.@mokly-cloud/tokens depends on AGPL source *",
      "packages/viewer/package.json: optionalDependencies.local depends on AGPL source file:../../packages/app",
      "packages/viewer/package.json: optionalDependencies.absolute depends on AGPL source file:/repo/packages/app",
    ],
  );
});
