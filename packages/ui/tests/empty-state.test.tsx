import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  EmptyAction,
  EmptyLine,
  EmptyState,
  HomeState,
  MissingRouteState,
  RemovedState,
  RemovedVariantState,
} from "../src/empty-state/empty-state.js";

test("the home names the catalogue, how to browse it, and what it holds", () => {
  assert.equal(
    renderToString(<HomeState summary="3 screens · 1 user flow" />),
    '<div class="mbk-empty"><h2>Mokly</h2><p>Browse the mockup catalogue: expand folders and choose an item from the navigation.</p><p class="mbk-empty-note">3 screens · 1 user flow</p></div>',
  );
  // An empty catalogue has no summary line.
  for (const summary of [undefined, ""])
    assert.doesNotMatch(
      renderToStaticMarkup(<HomeState summary={summary} />),
      /mbk-empty-note/u,
    );
});

test("a route that matches no entry shows the path and a link home", () => {
  assert.equal(
    renderToString(<MissingRouteState requested="view/missing/" />),
    '<div class="mbk-empty"><h2>Item not found</h2><p>Nothing in the catalogue matches <code>view/missing/</code></p><a class="mbk-empty-link" href="/">Go to the catalogue home</a></div>',
  );
  render(<MissingRouteState requested="view/missing/" />);
  assert.ok(screen.getByRole("heading", { name: "Item not found" }));
  assert.equal(
    screen
      .getByRole("link", { name: "Go to the catalogue home" })
      .getAttribute("href"),
    "/",
  );
});

test("a removed entry's stage names its kind, and a variant names itself", () => {
  const removed = (kind: Parameters<typeof RemovedState>[0]["kind"]) =>
    renderToString(<RemovedState kind={kind} />);
  const stage = (title: string, body: string) =>
    `<div class="mbk-empty" data-mokly-stage="" data-viewport="both"><h2>${title}</h2><p>${body}</p></div>`;
  assert.equal(
    removed("flow"),
    stage(
      "This user flow was removed",
      "This flow is no longer in the catalogue.",
    ),
  );
  assert.equal(
    removed("screen"),
    stage("This screen was removed", "There is no current preview to show."),
  );
  for (const kind of ["component", "variant"] as const)
    assert.equal(
      removed(kind),
      stage(
        `This ${kind} was removed`,
        "Select a comparison to see the previous version.",
      ),
    );
});

test("a removed variant that the workspace keeps selected marks its stage", () => {
  assert.equal(
    renderToString(<RemovedVariantState />),
    '<div class="mbk-empty" data-mokly-stage="" data-viewport="both" data-workspace-empty=""><p>This variant was removed. Select a comparison to see its previous version.</p></div>',
  );
});

test("a busy state announces its body, and an alert names its failure", () => {
  assert.equal(
    renderToStaticMarkup(<EmptyState body="Loading…" busy stage />),
    '<div aria-busy="true" class="mbk-empty" data-mokly-stage="" data-viewport="both"><p role="status">Loading…</p></div>',
  );
  assert.equal(
    renderToStaticMarkup(
      <EmptyState
        action={{ label: "Try again" }}
        body="Still available."
        role="alert"
        title="Failed"
      />,
    ),
    '<div class="mbk-empty" role="alert"><h2>Failed</h2><p>Still available.</p><button class="mbk-empty-link" type="button">Try again</button></div>',
  );
  assert.equal(
    renderToStaticMarkup(<EmptyState />),
    '<div class="mbk-empty"></div>',
  );
});

test("a button action reports each press and carries its mark", () => {
  let presses = 0;
  render(
    <EmptyState
      action={{
        label: "Retry",
        mark: "data-mokly-preview-retry",
        onClick: () => presses++,
      }}
      title="Unavailable"
    />,
  );
  const retry = screen.getByRole("button", { name: "Retry" });
  assert.equal(retry.getAttribute("data-mokly-preview-retry"), "");
  fireEvent.click(retry);
  fireEvent.click(retry);
  assert.equal(presses, 2);
});

test("the action can stand inline, and a line stands in for content", () => {
  assert.equal(
    renderToStaticMarkup(
      <EmptyAction
        action={{ label: "Try again", mark: "data-diff-refresh" }}
      />,
    ),
    '<button class="mbk-empty-link" data-diff-refresh="" type="button">Try again</button>',
  );
  assert.equal(
    renderToStaticMarkup(<EmptyAction action={{ href: "/a", label: "A" }} />),
    '<a class="mbk-empty-link" href="/a">A</a>',
  );
  assert.equal(
    renderToStaticMarkup(<EmptyLine>Nothing here.</EmptyLine>),
    '<p class="mbk-empty">Nothing here.</p>',
  );
});
