import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { Publication, PublicationPullRequest } from "../../api/types";
import { changesCheck } from "../../viewer/check-card";

import { publication } from "./fixtures";

/** The pull request a check link opens, as its publication carries it. */
const pull: PublicationPullRequest = {
  number: 42,
  title: "Name the pull request",
  author: "octocat",
  url: "https://github.com/octocat/Hello-World/pull/42",
};

/** The words of some markup, as a reader meets them. */
function words(markup: string): string {
  return markup.replaceAll(/<[^>]*>/g, "");
}

test("a pull request's publication with a comparison gets the Mokly check with its totals line and its checks link", () => {
  const card = changesCheck(
    publication({
      pullRequest: pull,
      changes: { state: "available", changed: 3, added: 1, removed: 2 },
    }),
  );
  assert.ok(card);
  const html = renderToStaticMarkup(card);
  const links = [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 1);
  const [link = "", attributes = "", label = ""] = links[0] ?? [];
  // The card's one way on is the pull request's checks on GitHub, which it
  // opens in the same tab, as the bar's GitHub link does.
  assert.equal(
    /href="([^"]*)"/.exec(attributes)?.[1],
    "https://github.com/octocat/Hello-World/pull/42/checks",
  );
  assert.doesNotMatch(attributes, /target=/);
  assert.equal(words(label), "#42 · Name the pull request");
  // Above the link, the result names the check and gives its totals line.
  assert.equal(
    words(html.replace(link, "")),
    "Mokly 3 changed, 1 added, 2 removed.",
  );
  assert.doesNotMatch(html, /<button/);
});

test("a branch's publication and a publication without a comparison get no check", () => {
  const nothing = { changed: null, added: null, removed: null };
  const cases: [string, Publication | undefined][] = [
    ["a branch's publication", publication({ pullRequest: null })],
    [
      "no comparison",
      publication({
        pullRequest: pull,
        changes: { state: "no-comparison", ...nothing },
      }),
    ],
    [
      "an unavailable comparison",
      publication({
        pullRequest: pull,
        changes: { state: "unavailable", ...nothing },
      }),
    ],
    [
      "a comparison without counts",
      publication({
        pullRequest: pull,
        changes: { state: "available", ...nothing },
      }),
    ],
    ["no publication", undefined],
  ];
  for (const [name, shown] of cases)
    assert.equal(changesCheck(shown), undefined, name);
});
