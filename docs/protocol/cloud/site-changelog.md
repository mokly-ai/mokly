# Site Changelog

This is the changelog sub-contract of [Site](./site.md). The page reads as the
version history of the depicted design file. [Site design](./site-design.md)
owns its look, and [Site mockups](./site-mockups.md) owns the depicted release
facts.

## Source

`/changelog` renders every release in the installed package's `CHANGELOG.md`
newest first. Each release shows the version as **Mokly CLI `<version>`**, the
release date from its heading, every group of notes in the changelog's order
with their links preserved, and one link to the GitHub compare or release view
from the heading. A release whose heading has no link shows no link. If the
file has no release headings, the page shows **Updates will appear here**. The
page also publishes an Atom feed at `/changelog.xml`, linked from every page.

The parser never guesses a date or invents a title: a level-two heading that
names a version but not a release date fails the build rather than publishing
a half-read release, and a level-two heading that names no version is prose
the file keeps beside its releases and is skipped with everything under it.
Notes keep their links, code spans and the emphasis the release tool writes
around a commit scope. A release's upgrade notes render in full, with their
topics as headings.

## Page

Top to bottom, the page holds the title `What’s new in Mokly` with the lead
`Every release of the Mokly CLI, newest first.`, the timeline, the note
filter, a full frame for each of the six newest releases, and Earlier
releases. Version history floats beside the frames on wide pages; narrower
pages leave it out.

- Version history: a navigation panel that counts the releases in its head and
  lists every release under its month, newest first. Each row links to its
  release and shows the version, the date and a mark for breaking changes.
  The panel's foot links the Atom feed.
- Timeline: one keyframe for each release at its date, with patches and
  breaking releases marked apart. The timeline is a
  [depiction](./site.md#accessibility), because Version history holds the same
  links.
- Note filter: a radio group named "Show notes" with **All**, **Breaking**,
  **Features**, **Fixes** and **Performance**, each with its count of notes.
  A choice shows only the notes of that group and the releases that list them.
  A status line, announced politely, counts the notes and the releases on
  show. A link to a release that the filter hides first returns the filter to
  **All**.
- Release frame: the heading, the date, **Latest** on the newest release,
  **Read release details**, which opens the heading's link, and the compare
  range. A chip for each group counts its notes and links to the group.
  Breaking changes are a callout pinned to the frame, with
  `Read before you upgrade.` When the release has upgrade notes, an Upgrade
  notes chip links to them, and they close the groups in a closed disclosure
  that names the release, lists the topics and counts them.
- Earlier releases: one section that counts the older releases and gives their
  date range, with each older release as a compact frame. A compact frame
  shows the version, the date, the count chips and **Read release details**,
  and holds its notes in a closed disclosure.
- A link to a target inside a closed disclosure opens that disclosure. The
  release in view is selected, its Version history row is current, and the
  timeline's playhead stands on it.
- Without script, every release and every note stays readable, and the filter
  does not show.
