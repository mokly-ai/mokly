import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { PublicationPullRequest } from "../../../api/types";
import type { SlotInput } from "../../../screens/viewer/slots";
import { chromeSubject } from "../../../screens/viewer/subject";
import "../../server-render";
import { publication } from "../../viewer/fixtures";
import { project } from "../../viewer/stage-view-fixtures";

/**
 * The publication slot, loaded after the doubles that stand in for Expo
 * Router and the package Button in Node.
 */
async function slots() {
  const { viewerSlots } = await import("../../../screens/viewer/slots");
  const { barPlacement } = await import("../../../viewer/bar");
  return { viewerSlots, barPlacement };
}

/** The observation of the pull request that produced the publication. */
const observed: PublicationPullRequest = {
  number: 8,
  title: "Retain the author login",
  author: "octocat",
  url: "https://github.com/octocat/Hello-World/pull/8",
};

/**
 * The tooltip of the full bar's publication pill, for a publication whose pull
 * request observation names this author, or none. The tooltip holds every
 * word the pill shows, so it is what the reader can read whole.
 */
async function pillTitle(author: string | null): Promise<string> {
  const { viewerSlots, barPlacement } = await slots();
  const shown = publication({ pullRequest: { ...observed, author } });
  const nothing = () => undefined;
  const ref = { current: null };
  const input: SlotInput = {
    session: {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "",
        email: "reader@example.com",
        githubConnected: false,
      },
      csrfToken: "csrf",
      workspaceIds: [],
    },
    project,
    subject: chromeSubject({
      entry: { kind: "publication", publication: shown },
      publication: shown,
    }),
    view: "all",
    settingsOpen: false,
    placement: barPlacement(false),
    moreOpen: false,
    accountOpen: false,
    shareable: true,
    refs: {
      projects: ref,
      switcher: ref,
      history: ref,
      share: ref,
      account: ref,
      more: ref,
    },
    onPanel: nothing,
    account: { onSettings: nothing, onSignOut: nothing, onLeave: nothing },
    onMoreOpen: nothing,
    onAccountOpen: nothing,
  };
  const html = renderToStaticMarkup(viewerSlots(input).publication);
  const title = /class="fo-canvas-pill" title="([^"]*)"/.exec(html)?.[1];
  assert.ok(title !== undefined, html);
  return title;
}

test("a pull request's author leads the publication's state", async () => {
  assert.match(
    await pillTitle("octocat"),
    /^#8 Retain the author login, octocat · Ready · [^·,]+, 76d15b6$/,
  );
});

test("a pull request without an observed author names no author", async () => {
  // An author would lead the phrase, attached by a separator of its own. The
  // phrase leading with the state says nothing was put where the author is
  // not known.
  assert.match(
    await pillTitle(null),
    /^#8 Retain the author login, Ready · [^·,]+, 76d15b6$/,
  );
});
