import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { currentManifest } from "../../../tests/helpers/current_manifest.js";
import type { ManifestScreen, ManifestV9 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import type { ShellInitialState } from "../src/shell/store_state.js";
import { StandaloneShellDocument } from "../src/standalone/document.js";

const screen = {
  colorSchemes: ["light", "dark"],
  declaredDependencies: [],
  description: "Welcome screen",
  path: "welcome",
  kind: "screen",

  relatedDocs: [],
  sourcePath: "entries/welcome.mockup.tsx",
  title: "Welcome",
  useCasePaths: [],
} satisfies ManifestScreen;
const manifest: ManifestV9 = currentManifest({
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 9,
  folders: [],
  sourceFiles: [screen.sourcePath],
});

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
        changedEntries: [screen.path],
        componentChanges: {
          baseline: manifest,
          screenViews: [
            {
              path: screen.path,
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
