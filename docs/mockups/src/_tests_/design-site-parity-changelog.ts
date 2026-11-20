/**
 * The recorded parity differences of the changelog area: the workspace,
 * Version history and the release frames. `design-site-parity.test.ts`
 * merges this list with the lists of the other areas. Each key is a selector
 * that the mockup sheets and the site sheets both declare with different
 * values; each value says why, and which milestone of the Canvas redesign
 * plan removes the difference.
 */

const MILESTONE = "Canvas changelog; Milestone 8 rebuilds the changelog";

const HISTORY = `Version history is a floating panel of 44px rows on one rail, sticky beside the frames; ${MILESTONE}`;
const FRAME = `each release is a frame on the canvas with its anchor label, a large version and its date over the count chips; ${MILESTONE}`;
const NOTES = `the note groups sit on a rail beside their notes, each note a row with its links in a right-hand column; ${MILESTONE}`;

export const CHANGELOG_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-changelog-body": `Version history and the frames share a workspace, the frames up to 1080px and centred; ${MILESTONE}`,
  ".site-release-index": HISTORY,
  ".site-release-index-date": HISTORY,
  ".site-release-index-version": HISTORY,
  ".site-releases": FRAME,
  ".site-release": FRAME,
  ".site-release-meta": FRAME,
  ".site-release-meta h2": FRAME,
  ".site-release-meta time": FRAME,
  ".site-release-link": `Read release details is an outlined button beside the compare range; ${MILESTONE}`,
  ".site-release-notes": NOTES,
  ".site-release-notes ul": NOTES,
  ".site-release-notes li": NOTES,
  ".site-release-group": NOTES,
  ".site-release-group-head": NOTES,
};
