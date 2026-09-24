import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true]) {
  test(`v${components ? 5 : 4} omits material for paired ignored edits alongside matched CSS`, async (t) => {
    const fixture = await cssAttributionFixture(t, components, {
      body: '<ReviewIgnore id="notice"><p>Before notice</p></ReviewIgnore><button className="auth">Sign in</button>',
      prepare: async ({ entryPath }) => {
        if (!components)
          await fs.writeFile(
            entryPath,
            (await fs.readFile(entryPath, "utf8")).replace(
              "defineUseCase }",
              "defineUseCase, ReviewIgnore }",
            ),
          );
      },
    });
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replaceAll(
        "Before notice",
        "After notice",
      ),
    );
    await fixture.append(".auth { padding: 2px; }");
    const { result } = await fixture.compare();
    for (const view of result.screens.find((screen) => screen.id === "home")!
      .views) {
      assert.equal(view.material, undefined);
      assert.equal(view.state, "changed");
      assert.deepEqual(view.ignoredIds, ["notice"]);
    }
  });
  test(`v${components ? 5 : 4} distinguishes material changes from stylesheet evidence`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replaceAll(
        "Sign in",
        "Continue",
      ),
    );
    await fixture.append(".auth { padding: 2px; } .guide { padding: 3px; }");
    const { result } = await fixture.compare();
    for (const screen of result.screens)
      for (const view of screen.views) {
        assert.equal(view.material, screen.id === "home" ? true : undefined);
        assert.equal(view.state, "changed");
        assert.equal(view.reasons?.[0]?.analysis?.status, "matched");
      }
  });

  test(`v${components ? 5 : 4} marks added and removed views as material`, async (t) => {
    const fixture = await cssAttributionFixture(t, components);
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replaceAll(
        "screens/home.html",
        "screens/moved.html",
      ),
    );
    const { result } = await fixture.compare();
    const views = result.screens
      .filter((screen) => screen.id === "home")
      .flatMap((screen) => screen.views);
    assert.ok(views.some((view) => view.state === "added"));
    assert.ok(views.some((view) => view.state === "removed"));
    assert.ok(views.every((view) => view.material === true));
  });
}
