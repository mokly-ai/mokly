import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { tabAt } from "../page-window";
import { draw, recordingPage } from "../server-render";

/**
 * The card of a pull request that closed or merged with nothing published:
 * the title names how it closed and is the whole message, and the one way on
 * is the switcher.
 */
test("a closed or merged pull request's card names how it closed", async () => {
  const { ClosedPullRequest } = await import("../../viewer/stage");
  const titles = {
    closed: "This pull request is closed",
    merged: "This pull request was merged",
  } as const;
  for (const state of ["closed", "merged"] as const) {
    const chosen: string[] = [];
    const { html, buttons } = draw(
      recordingPage(tabAt()).page,
      createElement(ClosedPullRequest, {
        state,
        onChoose: () => chosen.push(state),
      }),
    );
    const headings = [...html.matchAll(/<h\d[^>]*>([^<]*)<\/h\d>/g)].map(
      (heading) => heading[1],
    );
    assert.deepEqual(headings, [titles[state]], state);
    assert.doesNotMatch(html, /fo-state-detail/, state);
    assert.deepEqual(
      buttons.map((button) => button.label),
      ["Choose another branch"],
      state,
    );
    for (const button of buttons) button.onPress?.();
    assert.deepEqual(chosen, [state]);
  }
});
