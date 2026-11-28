import assert from "node:assert/strict";
import test from "node:test";

import {
  identityComponents,
  identityNames,
  identityScreen,
} from "./fixtures/sidecar/story-component-identity.js";
import {
  storyMetas,
  storyUseFixture,
  withoutUsageMarkers,
} from "./helpers/story_use_render.js";

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} keeps component bindings, statics, and ordinary calls`, async (context) => {
    const names = identityNames
      .filter((name) => name !== "Cycle")
      .map((name) => (name === "Default" ? "default as Default" : name));
    const fixture = await storyUseFixture(context, {
      "components.tsx": identityComponents,
      "barrel.ts": `export { ${names.join(", ")} } from "./components.js";
                    export { Cycle } from "./cycle.js";`,
      "cycle.tsx": `import { early } from "./cycle-read.js";
                    export function Cycle() { return <b>cycle</b>; }
                    export function seesSame() { return early === Cycle; }`,
      "cycle-read.ts": `import { Cycle } from "./cycle.js";
                        export const early = Cycle;`,
      "screen.mockup.tsx": identityScreen,
      ...storyMetas("./barrel.js", identityNames),
    });
    const plain = await (await fixture.compile(vite, false)).screen();
    const recorded = await fixture.compile(vite);
    const result = await recorded.screen();
    assert.match(plain.html, /data-identity="true"/u);
    assert.match(plain.html, /data-statics="Changed,5,2"/u);
    assert.match(plain.html, /data-utility="19,2,true,8,1,tag:6:1"/u);
    assert.equal(withoutUsageMarkers(result.html), plain.html);
    assert.deepEqual(
      result.instances.map(({ componentPath }) => componentPath),
      identityNames,
    );
    assert.deepEqual(await (await recorded.restore()).screen(), result);
  });
}
