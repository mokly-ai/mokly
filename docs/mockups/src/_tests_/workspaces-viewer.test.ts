/**
 * The workspace model's viewer drawing: the projects panel names every GitHub
 * account each workspace connects, joined as the app joins them.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { githubAccounts, sample } from "../fixtures/product";
import { workspaces } from "../fixtures/publications";
import { appSource } from "./app-parity-reads";
import { byClass, label } from "./design-site-test-helpers";
import { drawnPage } from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

const viewports = ["desktop", "mobile"] as const;
const panel = (slug = "") =>
  "product/viewer/projects" + (slug ? "/" + slug : "");
const named = githubAccounts.map((account) => account.name);

/** Each workspace group's name and the detail lines beside it. */
function groups(page: DrawnPage): [string, string[]][] {
  return byClass(page.main, "fo-ref-group").map((group) => [
    label(byClass(group, "fo-ref-name")[0]),
    byClass(group, "fo-ref-detail").map(label),
  ]);
}

test("the projects panel names every GitHub account a workspace connects", () => {
  assert.deepEqual(named, ["mokly-ai", "cal"]);
  for (const viewport of viewports)
    for (const slug of ["", "empty"]) {
      const id = panel(slug);
      // Cal's own workspace connects no account, so its head draws no line.
      assert.deepEqual(
        groups(drawnPage(id, viewport)),
        [
          [sample.workspace, [named.join(", ")]],
          [workspaces[1].name, []],
        ],
        id + " " + viewport,
      );
    }
  // While the panel loads, one group stands for the workspaces and names none
  // of them: its name and its accounts are bars. A failed load draws none.
  for (const viewport of viewports) {
    assert.deepEqual(
      groups(drawnPage(panel("loading"), viewport)),
      [["", [""]]],
      "loading",
    );
    assert.deepEqual(groups(drawnPage(panel("error"), viewport)), [], "error");
  }
});

test("the app joins a workspace's account names as the panel draws them", () => {
  const source = appSource("viewer/panels/projects.tsx");
  const separator =
    /\.map\(\(installation\) => installation\.account\)\s*\.join\("([^"]*)"\)/.exec(
      source,
    )?.[1];
  assert.ok(separator !== undefined, "the app joins no account names");
  const [team] = groups(drawnPage(panel()));
  assert.deepEqual(team, [sample.workspace, [named.join(separator)]]);
  // Both draw the line only when the workspace connects an account.
  assert.match(
    source,
    /\{accounts &&\s*\(?\s*<span className="fo-ref-detail">\s*\{accounts\}\s*<\/span>\s*\)?\s*\}/,
  );
});
