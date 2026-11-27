/**
 * The workspace model's account drawings: the install step for each role, an
 * installation connected from GitHub, the repository step over several GitHub
 * accounts, and the CLI form for a repository the App does not read.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ComponentInstanceRecord } from "@mokly/viewer";

import { selectorInput } from "../components/selector";
import { MockupDocument } from "../document";
import { githubAccounts, sample } from "../fixtures/product";
import { workspaces } from "../fixtures/publications";

import { catalogueEntries, viewUsage } from "./catalogue-index";
import {
  actions,
  destination,
  drawnPage,
  facts,
  links,
  stepsDone,
} from "./drawn-page";

const cli = "Publish with the CLI instead";
const viewports = ["desktop", "mobile"] as const;

/** One string prop of a drawn instance, or nothing when it is absent. */
function stringProp(
  instance: ComponentInstanceRecord,
  name: string,
): string | undefined {
  const value = instance.props[name];
  return value?.[0] === "string" ? value[1] : undefined;
}

/** Where the line to the CLI form leads on one page, once per drawing of it. */
function cliLinks(id: string, viewport: (typeof viewports)[number]) {
  return links(drawnPage(id, viewport), cli).map(destination);
}

test("every reader who can create a project is offered the CLI form their workspace reaches", () => {
  // The install step draws a workspace with no connected account, so its line
  // opens the untouched form whose way back is the install step; the
  // repository step draws a connected workspace, so its line opens that form.
  const untouched = "product/account/choose-repository/cli/empty";
  const connected = "product/account/choose-repository/cli";
  const offered = {
    "product/account/install-app": untouched,
    "product/account/install-app/empty": untouched,
    "product/account/install-app/loading": undefined,
    "product/account/install-app/error": untouched,
    "product/account/install-app/desktop": untouched,
    "product/account/install-app/installing": untouched,
    "product/account/install-app/suspended-loading": untouched,
    "product/account/install-app/member": untouched,
    "product/account/install-app/reviewer": undefined,
    "product/account/install-app/connect": undefined,
    "product/account/install-app/connect/empty": undefined,
    "product/account/choose-repository": connected,
    "product/account/choose-repository/empty": connected,
    "product/account/choose-repository/loading": undefined,
    "product/account/choose-repository/error": connected,
    "product/account/choose-repository/suggestion-loading": connected,
    "product/account/choose-repository/open": connected,
    "product/account/choose-repository/one-account": connected,
    "product/account/choose-repository/slug-taken": connected,
  };
  for (const [id, form] of Object.entries(offered))
    for (const viewport of viewports)
      assert.deepEqual(
        cliLinks(id, viewport),
        form ? [form] : [],
        id + " " + viewport,
      );
});

test("the install step tells a member and a reviewer who acts, and offers nothing it cannot do", () => {
  for (const [id, title, line] of [
    [
      "product/account/install-app/member",
      "Install the Mokly app",
      "Ask an owner or admin to install it.",
    ],
    [
      "product/account/install-app/reviewer",
      "No projects yet",
      "Ask an owner or admin to create the first project.",
    ],
  ] as const)
    for (const viewport of viewports) {
      const page = drawnPage(id, viewport);
      assert.ok(page.html.includes("<h1>" + title + "</h1>"), id);
      assert.ok(page.html.includes(line), id);
      assert.deepEqual(actions(page), [], id + " draws no action");
      assert.deepEqual(
        links(page, "Back").map(destination),
        ["product/account/create-workspace"],
        id,
      );
      assert.equal(stepsDone(page), 1, id);
    }
});

test("an installation from GitHub is connected to a workspace the reader administers", () => {
  const continueOnGitHub = [["primary", "Continue on GitHub"]];
  for (const viewport of viewports) {
    const id = (slug: string) =>
      "product/account/install-app/connect" + (slug ? "/" + slug : "");
    const chosen = drawnPage(id(""), viewport);
    assert.deepEqual(actions(chosen), continueOnGitHub);
    assert.deepEqual(links(chosen, "Continue on GitHub").map(destination), [
      "product/account/choose-repository",
    ]);
    assert.ok(chosen.html.includes('data-testid="firna-selector"'));
    assert.ok(chosen.html.includes(sample.workspace));
    assert.deepEqual(facts(chosen), []);
    assert.equal(stepsDone(chosen), 1);

    const named = drawnPage(id("named-workspace"), viewport);
    assert.deepEqual(facts(named), [["Workspace", sample.workspace]]);
    assert.ok(!named.html.includes('data-testid="firna-selector"'));
    assert.deepEqual(actions(named), continueOnGitHub);

    // The open select lists the workspaces the reader administers, the chosen
    // one marked, and ends with the choice that creates a workspace.
    const open = drawnPage(id("open"), viewport);
    const list = open.html.slice(
      open.html.indexOf('data-testid="firna-options-list"'),
    );
    const rows = [
      ...workspaces
        .filter((candidate) => candidate.administrator)
        .map((candidate) => ">" + candidate.name + "<"),
      ">Create a workspace<",
    ].map((text) => list.indexOf(text));
    assert.ok(
      rows.every((index) => index >= 0),
      viewport + " " + rows.join(),
    );
    assert.deepEqual(
      [...rows].sort((a, b) => a - b),
      rows,
    );
    assert.equal(list.match(/aria-selected="true"/g)?.length, 1);
    assert.deepEqual(actions(open), continueOnGitHub);

    const none = drawnPage(id("empty"), viewport);
    assert.ok(
      none.html.includes("Create a workspace to connect this account."),
    );
    assert.deepEqual(actions(none), [["primary", "Create a workspace"]]);
    assert.deepEqual(links(none, "Create a workspace").map(destination), [
      "product/account/create-workspace",
    ]);
    // The reader has no workspace yet, so the strip claims none.
    assert.equal(stepsDone(none), 0);

    const loading = drawnPage(id("loading"), viewport);
    assert.ok(loading.html.includes("Loading your workspaces"));
    assert.ok(loading.html.includes('aria-busy="true"'));
    assert.deepEqual(actions(loading), []);

    const failed = drawnPage(id("error"), viewport);
    assert.ok(failed.html.includes(">Workspaces couldn’t load<"));
    assert.deepEqual(actions(failed), [["primary", "Try again"]]);
    assert.ok(failed.html.includes("<summary>Details</summary>"));

    for (const slug of [
      "",
      "named-workspace",
      "open",
      "empty",
      "loading",
      "error",
      "connecting",
    ])
      assert.ok(
        drawnPage(id(slug), viewport).html.includes(
          "<h1>Connect a GitHub account</h1>",
        ),
        slug,
      );
  }
  // The action leaves for GitHub, so it carries the GitHub glyph in every view.
  const glyphs: (string | undefined)[] = [];
  for (const entry of catalogueEntries()) {
    if (entry.kind !== "screen") continue;
    if (!entry.path.startsWith("product/account/install-app/connect")) continue;
    for (const view of viewUsage(entry.path))
      for (const instance of view.instances)
        if (
          instance.componentId === "design/button" &&
          stringProp(instance, "label") === "Continue on GitHub"
        )
          glyphs.push(stringProp(instance, "icon"));
  }
  assert.ok(glyphs.length >= 8);
  assert.deepEqual([...new Set(glyphs)], ["github"]);
});

test("the repository step sends its manage line to where the accounts are kept", () => {
  for (const viewport of viewports) {
    for (const id of [
      "product/account/choose-repository",
      "product/account/choose-repository/empty",
      "product/account/choose-repository/suggestion-loading",
      "product/account/choose-repository/open",
      "product/account/choose-repository/slug-taken",
    ]) {
      const [manage, ...more] = links(
        drawnPage(id, viewport),
        "Manage repository access",
      );
      assert.equal(more.length, 0, id);
      assert.equal(destination(manage), "product/settings/github", id);
    }
    const one = drawnPage(
      "product/account/choose-repository/one-account",
      viewport,
    );
    const [manage] = links(one, "Manage repository access");
    assert.equal(destination(manage), undefined);
    assert.ok(
      one.html.includes(
        'href="' + githubAccounts[0].manageUrl + '" target="_blank"',
      ),
    );
    assert.ok(!one.html.includes(githubAccounts[1].name + "/"));
  }
});

test("the open select lists one titled section per account, the chosen repository marked", () => {
  const order = githubAccounts.flatMap((account) => [
    ">" + account.name + "<",
    ...account.repositories.map((repository) => ">" + repository.name + "<"),
  ]);
  for (const viewport of viewports) {
    const open = drawnPage("product/account/choose-repository/open", viewport);
    const list = open.html.slice(
      open.html.indexOf('data-testid="firna-options-list"'),
    );
    const at = order.map((text) => list.indexOf(text));
    assert.ok(
      at.every((index) => index >= 0),
      viewport + " " + at.join(),
    );
    assert.deepEqual(
      [...at].sort((a, b) => a - b),
      at,
      viewport,
    );
    assert.match(list, /aria-label="Search options"/);
    assert.match(list, /role="listbox"/);
    assert.equal(list.match(/aria-selected="true"/g)?.length, 1);
    for (const id of [
      "product/account/choose-repository",
      "product/account/choose-repository/one-account",
    ])
      assert.ok(
        !drawnPage(id, viewport).html.includes("firna-options-list"),
        id + " is drawn closed",
      );
  }
  // The registered select reads its choices from the sections it is given: a
  // value only a section holds shows that section's label on the closed field.
  // It renders on its own page, inside the renderer's wrapper, as Mokly draws
  // a component page.
  const context = { viewport: "desktop", colorScheme: "light" } as const;
  const select = selectorInput.render(
    {
      label: "Repository",
      value: "notes",
      options: [],
      sections: [
        { title: "cal", options: [{ value: "notes", label: "cal/notes" }] },
      ],
    },
    context,
  );
  const html = renderToStaticMarkup(
    createElement(MockupDocument, {
      entry: { kind: "component", path: "design/selector", title: "Selector" },
      ...context,
      children: select,
    }),
  );
  assert.ok(html.includes(">cal/notes<"));
});
