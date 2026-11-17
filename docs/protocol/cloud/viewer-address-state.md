# Viewer Address State

The cloud route owns the controlled selection supplied to the pinned
`@mokly/viewer` of [Viewer host](./viewer-host.md). This contract defines
immutable publication addresses, reference alias resolution, URL round trips,
panels and browser history. See
[Viewer](./viewer.md) for package loading, slots and isolation.

## Entry And Resolution

Canonical path: `/:workspaceSlug/:projectSlug/publications/:publicationId`.

| Entry          | Resolution                                                        | Retained publication context                                                           |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Publication ID | Exact `getPublication` in the authorized project                  | Its own branch and nullable originating PR                                             |
| Branch alias   | That branch's `latestPublicationId`                               | Selected ready publication; newest failed attempts stay in reference summaries/history |
| PR alias       | That PR's `latestPublicationId`, matched by admitted PR number    | Selected publication's `pullRequest`                                                   |
| Standalone     | Default branch's ready target, otherwise newest ready publication | Same immutable publication response                                                    |

Aliases are `/:workspaceSlug/:projectSlug/branches?branch=<name>` (names can
contain slashes) and
`/:workspaceSlug/:projectSlug/pull-requests/:number`. Resolution replaces
an alias with the publication address using both current slugs. It carries the
complete viewer selection, an open cloud `panel` and any settings pane. It
drops only `branch` and the router-reserved `screen`. The replacement address
names the publication. For example, `?branch=main&panel=history` becomes
`?panel=history` and opens History. Without a ready target the alias remains and
shows the reference's build, its failed newest publication or the publishing
card, as [Viewer builds](./viewer-builds.md#references-without-a-ready-publication)
orders them; a project that
cannot build keeps Set up publishing. An alias that shows its running build
resolves again once that build has published, which replaces it with the new
publication like any alias that gains a ready target. A current or retired
slug is only a lookup key; authorization still uses the resolved UUID project.

Build details are `/:workspaceSlug/:projectSlug/builds/:buildId`; that
address names no publication and carries no viewer selection keys: the route
corrects any it carries away, while `panel` and `settings` behave as on every
viewer route. Reference rows' `newestBuild` supplies the build state without a
read per row.

Reference rows carry `newestPublication` with the newest attempt's state,
admission time and head SHA. The switcher follows both paginated reference
lists through `nextCursor`, at most 20 pages of 50 rows. A capped list says
how many rows it read and offers both ways on. Standalone entry follows the
same complete branch traversal when the default branch has no ready target.
History reads one page.

## Selection Mapping

The address maps losslessly to the package selection:

| Package field | URL representation                                     |
| ------------- | ------------------------------------------------------ |
| `screenPath`  | `catalogueScreen`; absent maps to package `null`       |
| `snapshotId`  | `catalogueSnapshot`, only beside `catalogueScreen`     |
| `view`        | `view=changes`; All is omitted                         |
| `viewport`    | `viewport=mobile` or `both`; desktop is omitted        |
| `colorScheme` | `scheme=light` or `dark`; reader preference is omitted |
| `search`      | `search=<text>`; an empty search is omitted            |
| `tags`        | one `tag=<value>` per normalized tag, in package order |

The complete defaults are catalogue home, All, desktop, the signed-in color
preference (otherwise light), empty search and no tags. Cloud intentionally
keeps desktop as its URL default even though the standalone package defaults to
Both. `viewport=both` is first-class and is never collapsed. Search and tag
values use normal URL encoding; repeated `tag` is the only repeatable viewer
key. Empty, whitespace-containing or duplicate tags make an address invalid.
The package remains authoritative for its documented normalization of `tag:`
search terms. A removed entry selected by path alone resolves to its one
published record; that record's snapshot travels in later proposals.
Every complete `onSelectionChange` proposal is mapped back
without dropping or recreating fields.

Selected identities have a 2048 UTF-8 byte limit.
`catalogueScreen` is a complete entry path with one or more `/`-joined
`^[A-Za-z0-9_-]+$` segments. Preserve case. Reject empty
segments, dots, spaces, controls, backslashes and case-insensitive Windows
device names (`aux`, `con`, `nul`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`).
Reject `mokly-generated` as the first segment without case sensitivity.
Decode the query once with normal URL parsing. Repeated, empty, invalid or
overlong values are corrected away; valid unknown paths remain for the package
to resolve. App Share uses this same grammar.
The package's navigation-event type uses `screenPath`.
The host does not subscribe to `onScreenNavigate`.
`onSelectionChange` is the only package URL writer.

A screen or component variant is a catalogue entry with its own path, so
`catalogueScreen` names it. There is no variant key.
`catalogueSnapshot` names one previous version:
the 64-character lowercase hexadecimal `snapshotId` the package publishes for a
removed record. Absent, the address names current content. Two shapes are
corrected away, keeping the rest of the address:

- a repeated, empty or otherwise malformed `catalogueSnapshot`, keeping its
  screen, and a `catalogueSnapshot` with no valid `catalogueScreen`, because
  the package answers either with its unavailable view in place of the whole
  viewer;
- a `variantId` key, keeping its `catalogueScreen`. Only the catalogue knows
  which entry a variant name became, so the cloud never composes one from the
  parent and the variant.

A well-formed snapshot is the package's to resolve, as an entry path is.

The pinned package distinguishes a user route activation from an incompatible
controlled value supplied by the host. A package route activation proposes its
destination in one complete selection, with any filter clearing the
destination needs and All when the destination is not in Changes. A shell link
activated in Changes may also propose that destination's first changed viewport
and scheme in the same selection; the cloud writes it like any other proposal.
For an already controlled selection whose entry conflicts with its search or
tags, the package shows the destination in its stage without emitting a
replacement selection; the address therefore remains the host's requested value
while the visible filter hides it. Cloud does not guess package membership,
deep-import its normalizer or rewrite that address.

`catalogueScreen` is the only screen key because React Navigation reserves
`screen`. Cloud neither reads nor writes `screen`, and alias resolution drops
it. A copied address and the package's controlled state therefore agree.
`catalogueSnapshot` takes the same prefix rather than the package's own
`snapshot`, so the two halves of one catalogue record read as a pair beside the
app's own keys.

## Validation And Screen Knowledge

Syntactically invalid optional values are replaced with defaults. Routed-entry
and snapshot membership belong to the package, whose catalogue covers screens,
components, their variants, pages, documents, use cases and removed records. The cloud's
`listScreens` response covers only API-shareable screens and therefore never
validates or rewrites `catalogueScreen` or `catalogueSnapshot`: loading, a
successful nonempty list, `operation-unavailable` for current-only data and
other failures all preserve the complete package selection. A selected
component variant or previous version stays intact even when it does not
appear in a successful screen list.

The Share panel alone consumes `listScreens` and reports its read failure.
Cloud never derives entry or snapshot metadata from paths or filenames. An
unknown entry is the package's not-found view, with its navigation. An unknown
or stale snapshot is the package's unavailable state and one `selection` error;
the pinned package draws that state in place of the whole viewer, cloud slots
included. Neither is a value the host silently resets.

## Panels, Settings And History

`panel` is `projects`, `switcher`, `history` or `share`; absent means closed.
`settings` is owned by the settings dialog. Opening a panel or settings pushes
one entry. Moving between overlays replaces that entry. Close undoes it, so one
Back press restores the underlying viewer with its full screen, snapshot, view,
viewport, scheme, search and tags. Back and Forward re-read the complete
selection. A correction replaces the invalid address and preserves every key
owned by another surface.

Package selection proposals replace the current entry so typing search does not
create one history entry per keystroke. Opening and closing cloud overlays does
not reset package state. Alias resolution and settings query writes carry every
selection key unchanged.

On a newer-publication notification, keep the current publication and complete
selection mounted and offer **View latest**. The visible tab polls its current
reference every sixty seconds; a hidden tab does not. Never move a reader to a
new head silently.

## Sharing

URLs never contain email addresses, sessions, access cookies or project tokens.
Sharing changes no visibility and grants no access. Private sharing says
“Project members can open this link.” Public sharing says “Anyone with the link
can view.”

The API mints a link with the workspace and project slugs current at that
moment. Renaming either subject retains its old claim, so an already-copied
link still resolves and the app replaces it with both current slugs without
changing publication or selection state.

`getShareLink` accepts only `catalogueScreen`,
`viewport=desktop|mobile` and `scheme`. Search, tags, view, snapshot, panels and
settings are working-state only and are not sent to that operation. For a
comparison-backed publication, Share may offer an API-validated screen and its
single viewport/scheme view. Package `viewport=both` is omitted from the API
request because the operation does not support it. After the API returns the
canonical app URL, the host adds `viewport=both` to that URL. The recipient
therefore receives the same supported package viewport without broadening what
the API claims to validate.

Under the dark scheme, the pinned package shows the light view of a screen that
has no dark view. This doc calls that the light fallback. When the selected
viewport has no dark view of a screen, or neither viewport has one under Both,
Share still offers that screen. Its link names the light view with
`scheme=light`. Decision: Share links the light view rather than hiding the
screen or requiring the sender to switch to the light scheme, because the
viewer already shows that screen. The copied link and the sender's address
differ only by transient panel state, working-state fields that Share does not
carry and, for a light fallback, `scheme=light` in place of the sender's dark
scheme.

For a current-only publication, `listScreens` and screen-specific
`getShareLink` return `operation-unavailable`. Share must therefore omit the
package-selected screen and copy the real publication-level link; it must not
call the unsupported operation, fail the whole panel, claim that the
publication has no screens, or erase the package selection.
