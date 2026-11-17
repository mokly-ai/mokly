/**
 * The drawn pages of the account and recovery families, and the product
 * fixtures that they draw: who is signed in, where a page may leave for the
 * public site, and which workspace and repository identities they show.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  addresses,
  githubAccounts,
  members,
  workspace,
  project,
} from "../fixtures/product";
import { membership, onboarding, profile } from "../fixtures/product-states";
import { site, siteOrigin } from "../fixtures/site";

import { callbackLandingPages } from "./callback-landings";
import { catalogueRoot, screenFile } from "./catalogue-paths";
import { drawnPage, pendingLabels } from "./drawn-page";
import { productFamilies, productStates } from "./product-families";
import { inventoryPages } from "./product-inventory";
import { productSituations, situationStatePaths } from "./product-situations";

const repository = resolve(catalogueRoot, "../..");

function rustStringArray(source: string, name: string): string[] {
  const body = new RegExp(
    "pub const " + name + "\\s*:[^=]+=\\s*&\\[([\\s\\S]*?)\\];",
  ).exec(source)?.[1];
  assert.ok(body, name);
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

test("invitation handoff shows the account that is actually signed in", () => {
  const page = (state: string) =>
    readFileSync(
      screenFile(
        "product/account/invitation-accept" + (state ? "/" + state : ""),
        "desktop",
      ),
      "utf8",
    );
  assert.ok(page("").includes("sam@example.com"));
  assert.ok(page("").includes("Accepting invitation"));
  assert.ok(page("loading").includes("Invitation accepted"));
  assert.ok(page("loading").includes("Opening your workspace"));
  assert.ok(!page("loading").includes("Accepting invitation"));
  assert.ok(page("empty").includes("cal@example.com"));
  assert.ok(!page("empty").includes("sam@example.com"));
  // "Joining the workspace" names the acceptance, so its name is heard only;
  // "Invitation accepted" does not name the workspace read, so its card does.
  assert.deepEqual(
    pendingLabels(drawnPage("product/account/invitation-accept")),
    [["Accepting invitation…", "screen-reader-only"]],
  );
  assert.deepEqual(
    pendingLabels(drawnPage("product/account/invitation-accept/loading")),
    [["Opening your workspace…", "visible"]],
  );
});

test("recovery has one dashboard action and no route, framework or product data", () => {
  const pages = inventoryPages().filter(({ path: id }) =>
    id.startsWith("product/recovery/not-found"),
  );
  assert.equal(pages.length, 4);
  for (const { path: id } of pages)
    for (const view of ["mobile", "desktop"] as const)
      for (const theme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(id, view, theme), "utf8");
        const visible = html
          .slice(html.indexOf("<body"))
          .replaceAll(/<!--[\s\S]*?-->/g, " ")
          .replaceAll(/<[^>]*>/g, " ");
        assert.equal(html.match(/data-testid="firna-button-/g)?.length, 1, id);
        assert.ok(html.includes("Page not found"), id);
        assert.ok(html.includes("Open dashboard"), id);
        for (const forbidden of [
          "404",
          "/dashboard",
          "/_sitemap",
          "Expo Router",
          onboarding.workspace,
          workspace.projects[0].name,
          addresses.project,
        ])
          assert.ok(!visible.includes(forbidden), id + " hides " + forbidden);
      }
});

test("the account family leaves for the public site only where the contract allows", () => {
  // The two setup steps that depend on the App also leave for GitHub's own page
  // for this installation, which is the only place what the App can read is
  // changed and a suspension is cleared. It is named here so the destination
  // stays one address the fixtures own rather than a link any screen may invent.
  const owned: readonly string[] = [
    ...Object.values(site),
    workspace.manageUrl,
  ];
  // The install step names the suspension only GitHub clears, and the
  // repository step of a workspace with one account sends the line beneath
  // its field there. With several accounts the line opens the GitHub accounts
  // pane instead, which holds one such page per account.
  const managed = new Set([
    "product/account/install-app/error",
    "product/account/choose-repository/one-account",
  ]);
  const loggedOut = new Set(["sign-in", "sign-up", "magic-link", "callback"]);
  // A variant is a situation of the screen it hangs under, so whether the
  // wordmark leaves for the site is the owning screen's answer and not the
  // situation's: sign in refused a GitHub connect is still logged out.
  const accountPages = [
    ...productFamilies.account.flatMap((screen) =>
      productStates.map((state) => ({
        id:
          "product/account/" +
          screen +
          (state === "default" ? "" : "/" + state),
        screen,
        owner: screen as string,
        state,
      })),
    ),
    ...productSituations
      .filter((situation) => situation.family === "account")
      .flatMap((situation) =>
        situation.states.map((state, index) => ({
          id: situationStatePaths(situation)[index],
          screen: situation.name as string,
          owner: situation.screen as string,
          state,
        })),
      ),
    // The GitHub installation landings return to a reader who started the
    // flow signed in, so their wordmark stays home like every signed-in step.
    ...callbackLandingPages.map((page) => ({
      id: page.path,
      screen: page.path,
      owner:
        "signedIn" in page && page.signedIn ? "github-landing" : "callback",
      state: page.state,
    })),
  ];
  for (const { id: entry, screen, owner, state } of accountPages)
    for (const view of ["mobile", "desktop"] as const)
      for (const theme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(entry, view, theme), "utf8");
        const id = [screen, state, view, theme].join(" ");
        for (const href of [site.terms, site.privacy])
          assert.ok(html.includes('href="' + href + '"'), id + " " + href);
        const outbound = [...html.matchAll(/href="(https?:[^"]+)"/g)].map(
          (match) => match[1],
        );
        assert.ok(outbound.length >= 2, id);
        for (const href of outbound)
          assert.ok(owned.includes(href), id + " leaves the site: " + href);
        assert.equal(
          html.includes('href="' + site.home + '"'),
          loggedOut.has(owner),
          id + " wordmark destination",
        );
        // The finished project's one documentation link is the CI setup
        // guide: secondary while the default branch is publishing, and the
        // leading action once nothing is.
        assert.equal(
          html.includes('href="' + site.publishFromCi + '"'),
          screen === "project-created" && state === "default",
          id + " CI setup guide link",
        );
        assert.equal(
          html.includes(">Publish from CI<"),
          screen === "project-created" &&
            (state === "default" || state === "empty"),
          id + " CI setup guide",
        );
        assert.equal(
          html.includes('href="' + workspace.manageUrl + '"'),
          managed.has(entry),
          id + " installation link",
        );
        assert.ok(!html.includes('href="' + site.docs + '"'), id);
        assert.ok(!html.includes('href="' + site.changelog + '"'), id);
        assert.ok(!html.includes("marketing-"), id);
      }
  assert.ok(siteOrigin.startsWith("https://"));
});

test("membership and workspace fixtures keep repository identities coherent", () => {
  assert.deepEqual(
    members.map((member) => [member.name, member.role]),
    [
      ["Cal", "Owner"],
      ["Alex", "Admin"],
      ["Sam", "Reviewer"],
    ],
  );
  assert.ok(
    !new Set<string>(membership.active.map((person) => person.email)).has(
      membership.invited.email,
    ),
  );
  assert.equal(membership.selected.name, "Sam");
  assert.equal(profile.name, members[0].name);
  // The team's account comes first and holds every project's repository; the
  // personal account beside it holds one of its own.
  assert.deepEqual(
    githubAccounts.map((account) => [account.name, account.kind]),
    [
      ["mokly-ai", "Organization"],
      ["cal", "Personal"],
    ],
  );
  assert.equal(githubAccounts[0].manageUrl, workspace.manageUrl);
  for (const candidate of workspace.projects)
    assert.ok(
      githubAccounts[0].repositories.some(
        (repository) => repository.name === candidate.repository,
      ),
      candidate.repository,
    );
  for (const account of githubAccounts)
    for (const repository of account.repositories)
      assert.ok(repository.name.startsWith(account.name + "/"), account.name);
  assert.equal(workspace.slug, "mokly-team");
  assert.equal(project.slug, "mokly-cloud");
  assert.equal(addresses.project, "mokly.ai/mokly-team/mokly-cloud");
  assert.ok(
    workspace.projects.some(
      (candidate) =>
        candidate.repository === "mokly-ai/mokly-cloud" &&
        candidate.slug === project.slug,
    ),
  );
});

test("the successful workspace fixture is not a reserved address", () => {
  const source = readFileSync(
    resolve(repository, "crates/mkc-domain/src/slug.rs"),
    "utf8",
  );
  const reserved = new Set(
    [
      "SITE_FIRST_SEGMENTS",
      "EXPLICIT_SITE_FIRST_SEGMENTS",
      "EXPO_STATIC_FIRST_SEGMENTS",
      "APP_FIRST_SEGMENTS",
      "POLICY_RESERVED_SLUGS",
    ].flatMap((name) => rustStringArray(source, name)),
  );
  for (const name of readFileSync(
    resolve(repository, "crates/mkc-domain/data/github-reserved-names.txt"),
    "utf8",
  ).split(/\r?\n/))
    if (name) reserved.add(name);
  assert.equal(reserved.has(workspace.slug), false, workspace.slug);
});
