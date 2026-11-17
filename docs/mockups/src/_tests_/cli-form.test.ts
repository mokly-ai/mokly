/**
 * The CLI form: a project with no repository the App reads, named as the Mokly
 * CLI identifies it, from any Git host.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { causes, onboarding, placeholders } from "../fixtures/product-states";

import {
  actions,
  destination,
  drawnPage,
  links,
  pendingLabels,
  stepsDone,
} from "./drawn-page";

const viewports = ["desktop", "mobile"] as const;

test("the CLI form names a repository from any host and is refused with the way to its project", () => {
  assert.ok(!onboarding.cliRepository.startsWith("github.com/"));
  assert.ok(onboarding.cliRepository.split("/").length >= 3);
  const id = (slug: string) =>
    "product/account/choose-repository/cli" + (slug ? "/" + slug : "");
  for (const viewport of viewports) {
    for (const slug of ["", "empty", "loading", "error", "workspace-loading"])
      assert.ok(
        drawnPage(id(slug), viewport).html.includes(
          "<h1>Publish with the CLI</h1>",
        ),
        slug,
      );
    const filled = drawnPage(id(""), viewport);
    assert.ok(filled.html.includes('value="' + onboarding.cliRepository + '"'));
    assert.ok(filled.html.includes("/" + onboarding.cliProjectSlug + "<"));
    assert.deepEqual(actions(filled), [["primary", "Create project"]]);
    // The project has no repository link, so it cannot build: it lands where
    // nothing is publishing yet, never on a running build.
    assert.deepEqual(links(filled, "Create project").map(destination), [
      "product/account/project-created/empty",
    ]);
    // A workspace with connected accounts came from the repository step.
    assert.deepEqual(links(filled, "Back").map(destination), [
      "product/account/choose-repository",
    ]);
    assert.equal(stepsDone(filled), 2);

    const untouched = drawnPage(id("empty"), viewport);
    assert.ok(
      untouched.html.includes('placeholder="' + placeholders.repository),
    );
    assert.ok(!untouched.html.includes(onboarding.cliRepository));
    // A workspace with nothing installed came from the install step.
    assert.deepEqual(links(untouched, "Back").map(destination), [
      "product/account/install-app",
    ]);
    assert.equal(stepsDone(untouched), 1);

    const creating = drawnPage(id("loading"), viewport);
    assert.deepEqual(actions(creating), [["primary", "Creating…"]]);
    assert.ok(creating.html.includes('aria-busy="true"'));
    // Creating… already says it on screen, so the busy region is heard only.
    assert.deepEqual(pendingLabels(creating), [
      ["Creating project…", "screen-reader-only"],
    ]);

    const refused = drawnPage(id("error"), viewport);
    assert.deepEqual(actions(refused), [["primary", "Create project"]]);
    assert.ok(refused.html.includes(causes.duplicate));
    assert.deepEqual(links(refused, "Open it").map(destination), [
      "product/viewer/standalone",
    ]);
    assert.ok(refused.html.includes("<summary>Details</summary>"));
  }
});
