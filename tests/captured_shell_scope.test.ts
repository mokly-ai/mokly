import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import {
  projectScopedCatalogue,
  readLiveShellBootstrapState,
  serializeShellBootstrap,
} from "@mokly/viewer/runtime";

import {
  externalizeCapturedShell,
  readCapturedShellCatalogue,
} from "../dist/export/captured_shell.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  ),
);
const view = {
  kind: "target" as const,
  route: catalogue.screens[0]!.route,
};
const bootstrap = {
  catalogue: projectScopedCatalogue(catalogue, view),
  context: {
    base: "origin/main",
    comparisons: catalogue.comparisonUrl !== null,
    contentVersion: catalogue.revision.content,
    updateVersion: 1,
  },
  view,
};
const published = readCapturedShellCatalogue(catalogue);

test("capture externalizes one exact scoped projection", () => {
  const externalized = externalizeCapturedShell(
    "view/screens/home.html",
    shell(bootstrap),
    published,
  );
  const parsed = readLiveShellBootstrapState(state(externalized));
  assert.deepEqual(parsed.catalogue, {
    identity: catalogue.identity.id,
    kind: "external",
    path: "/__mokly/catalogue.json",
    revision: catalogue.revision,
  });
});

test("capture rejects one extra out-of-scope usage record", () => {
  const leaked = structuredClone(bootstrap);
  leaked.catalogue.components[0]!.variants[0]!.views[0]!.usage =
    structuredClone(catalogue.components[0]!.variants[0]!.views[0]!.usage);
  assert.throws(
    () =>
      externalizeCapturedShell(
        "view/screens/home.html",
        shell(leaked),
        published,
      ),
    /Invalid captured shell bootstrap|does not match the published model/,
  );
});

function shell(value: typeof bootstrap): string {
  return `<html><body><script data-mokly-shell-bootstrap="" type="application/json">${serializeShellBootstrap(value)}</script></body></html>`;
}

function state(html: string): unknown {
  const json = html.match(
    /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(json);
  return JSON.parse(json);
}
