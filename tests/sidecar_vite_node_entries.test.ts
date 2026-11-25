import assert from "node:assert/strict";
import test from "node:test";

import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

for (const side of ["head", "base"] as const) {
  for (const specifier of ["react-native-web", "react-native"]) {
    test(`Vite ${side} loads the server Node entry for ${specifier}`, async (context) => {
      const fixture = await reviewFixture(context, side);
      await fixture.write(
        "aliases.mjs",
        'export default { "react-native": "react-native-web" };',
      );
      await fixture.write(
        "vite.config.ts",
        `const helper = './aliases.mjs';
const { default: alias } = await import(helper);
export default { resolve: { alias } };`,
      );
      await fixture.write(
        "src/review.mockup.ts",
        reviewPage(
          'typeof View + "|" + StyleSheet.flatten(StyleSheet.create({ item: { color: "red" } }).item).color',
          `import { View, StyleSheet } from ${JSON.stringify(specifier)};`,
        ),
      );
      await assert.doesNotReject(async () => {
        assert.equal(
          (await fixture.render(await fixture.compile())).html,
          "<html><head></head><body>object|red</body></html>",
        );
      });
      await fixture.sidecar.call("shutdown");
    });
  }

  test(`Vite ${side} preserves styled-components CommonJS default interop`, async (context) => {
    const fixture = await reviewFixture(context, side);
    await fixture.write("vite.config.ts", "export default {};");
    const cases = [
      ["tsx", "function|function|undefined"],
      ["mjs", "object|undefined|function"],
      ["mts", "object|undefined|function"],
    ];
    fixture.params.entryFiles = cases.map(
      ([extension]) => `src/styled.mockup.${extension}`,
    );
    for (const file of fixture.params.entryFiles)
      await fixture.write(
        file,
        reviewPage(
          '[typeof styled, typeof styled.button, typeof styled.default].join("|")',
          'import styled from "styled-components";',
        ),
      );
    await assert.doesNotReject(async () => {
      const bundle = await fixture.compile();
      for (const [index, [, expected]] of cases.entries())
        assert.equal(
          (await fixture.render(bundle, fixture.params.entryFiles[index])).html,
          `<html><head></head><body>${expected}</body></html>`,
        );
    });
    await fixture.sidecar.call("shutdown");
  });
}
