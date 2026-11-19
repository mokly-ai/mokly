import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { styleAdaptersPlugin } from "../packages/mokly/src/sidecar/style-adapters-plugin.js";

import { bundleParams } from "./helpers/sidecar.js";

test("the style resolve filter includes aliases and excludes unrelated imports", async () => {
  const params = bundleParams();
  params.moduleResolution.aliases = {
    native: "react-native-web",
    "native/subpath": "unrelated",
    styled: "styled-components/dist",
    "@styles": "@emotion",
    "literal.name": "@emotion/react",
    unrelated: "unrelated",
    "near-styled": "styled-components-other",
    "near-emotion": "@emotion/react-other",
  };
  const filters: RegExp[] = [];
  const plugin = styleAdaptersPlugin(params, new Map());
  await build({
    stdin: { contents: "" },
    write: false,
    plugins: [
      {
        name: "registered-style-filter",
        setup(builder) {
          return plugin.setup({
            ...builder,
            onResolve(options, callback) {
              filters.push(options.filter);
              builder.onResolve(options, callback);
            },
          });
        },
      },
    ],
  });
  assert.equal(filters.length, 2);
  const filter = filters[1]!;
  for (const [specifier, expected] of [
    ["styled-components", true],
    ["styled-components/dist", true],
    ["react-native-web", true],
    ["react-native-web/dist", true],
    ["@emotion/react", true],
    ["@emotion/react/jsx-runtime", true],
    ["native", true],
    ["native/subpath", true],
    ["styled", true],
    ["styled/child", true],
    ["@styles/react", true],
    ["@styles/react/jsx-runtime", true],
    ["literal.name", true],
    ["literal.name/child", true],
    ["literalXname", false],
    ["./styled-components", false],
    ["prefix/styled-components", false],
    ["styled-components-extra", false],
    ["react-native-web-extra", false],
    ["@emotion/react-extra", false],
    ["native-extra", false],
    ["@styles-extra/react", false],
    ["unrelated", false],
    ["near-styled", false],
    ["near-emotion", false],
    ["react", false],
    ["./screen.tsx", false],
  ] as const)
    assert.equal(filter.test(specifier), expected, specifier);
});
