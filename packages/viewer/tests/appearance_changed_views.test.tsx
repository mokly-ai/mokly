import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ManifestScreen, ManifestV5 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import type { ShellInitialState } from "../src/shell/store_state.js";
import { StandaloneShellDocument } from "../src/standalone/document.js";

const screen = {
  declaredDependencies: [],
  dependencies: [],
  description: "Welcome screen",
  fragments: {
    mobile: "welcome.mobile.html",
    desktop: "welcome.desktop.html",
  },
  darkFragments: {
    mobile: "welcome.mobile.dark.html",
    desktop: "welcome.desktop.dark.html",
  },
  id: "welcome",
  kind: "screen",
  navPath: [],
  relatedDocs: [],
  route: "welcome.html",
  sourcePath: "entries/welcome.mockup.tsx",
  title: "Welcome",
  useCaseIds: [],
  viewports: ["mobile", "desktop"],
} satisfies ManifestScreen;
const manifest: ManifestV5 = {
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 5,
  sourceFiles: [screen.sourcePath],
};

function render(colorScheme: "light" | "dark", home = false): string {
  const initialState: ShellInitialState = {
    colorScheme,
  };
  return renderToStaticMarkup(
    <StandaloneShellDocument
      catalogue={createCatalogue(manifest)}
      context={{
        base: "main",
        updateVersion: 1,
        changesStatus: "ready",
        changedRoutes: [screen.route],
        componentChanges: {
          baseline: manifest,
          screenViews: [
            {
              route: screen.route,
              views: [
                { viewport: "mobile", colorScheme: "dark", state: "changed" },
              ],
            },
          ],
        },
      }}
      initialState={initialState}
      view={
        home
          ? { kind: "home" }
          : { kind: "target", target: { kind: "entry", entry: screen } }
      }
    />,
  );
}

test("standalone Appearance retains hidden-view change evidence", () => {
  const html = render("light");
  const appearance = html.match(
    /<label class="mbk-appearance"[\s\S]*?<\/label>/,
  )?.[0];
  assert.ok(appearance);
  assert.match(appearance, /data-view-changed="scheme"(?! hidden)/);
  assert.match(appearance, /aria-describedby="mb-view-changed-scheme"/);
  assert.match(appearance, /Other theme changed/);
  assert.doesNotMatch(html, /data-workspace-scheme/);

  for (const unmarked of [render("dark"), render("light", true)]) {
    const control = unmarked.match(
      /<label class="mbk-appearance"[\s\S]*?<\/label>/,
    )?.[0];
    assert.ok(control);
    assert.match(control, /data-view-changed="scheme" hidden=""/);
    assert.doesNotMatch(control, /aria-describedby/);
  }
});
