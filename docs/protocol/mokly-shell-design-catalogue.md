# Depicted Design Catalogue

Status: The depicted canonical branch does not list the Example tour in Changes yet. [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) lists it.

## Depicted Catalogue

The artboards browse one fixture catalogue in the path model, so the
navigation, the entry paths and the details agree across screens:

- Specs lists `Example`, `Account`, and `Design`; the catalogue's order record
  names Example first. Example's README is the folder's own page and its first
  row, `Overview`, above `Screens` (Welcome with its variants, and Details),
  `Example tour`, and the `Getting started` page. `Account` holds
  `Billing & Payments`, titled by its folder record because its slug is
  `billing`, with the Invoice screen, its Overdue variant, and the Payment
  terms document.
- `Account` also holds `Profile`, a screen at `account/profile` that is its
  folder's own page because its module is `account/profile/index.mockup.tsx`.
  Its row follows `Billing & Payments`, because a folder row sorts before an
  entry row, and stands in for the folder: a link beside a disclosure named
  `Show contents of Profile`, whose list holds its `Unverified email` variant
  and then the folder's `Notifications` and `Security` screens. Canonical All
  states keep that list closed.
- Components lists the same `Example` folder above its `Components` library,
  so a folder holding both kinds appears in each section with only that
  section's children.
- Inspect's Path row and the path chips show paths such as
  `example/screens/welcome`. A component's details add the shown entry's
  path, a document's details name its Markdown source, and a moved entry's
  details add a `Moved from` row with its previous path. A removed entry's
  details keep the base commit's record, with a `Location` row that names the
  folders that held it.

## Depicted Branches

The canonical branch changed Welcome, added Details, moved `billing` under
`account`, and removed five screens: Farewell, Survey, Invite, Archive and
Timeline. Changes counts ten entries and lists the removed screens last.
Invoice moved with edits; its Overdue variant and Payment terms moved
unchanged. Each keeps one row labelled `· Moved` at its new place. The
[Canvas states](#canvas-states) browse this branch, and so does the kept tag
picker screen.

The Canvas states that the canonical branch cannot show depict branches of
their own:

| Branch               | Change                                                                                                                                   | Changes count                                                  | Canvas states                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Action               | The Action's render changed the corners and the padding of its button                                                                    | 4: the Action and its three saved variants                     | `design/canvas/components/compare`, `usage`, `affected` and their variants, except `direct`        |
| Direct change        | The Action branch's change, and Welcome changed the label of its own Action from `Continue` to `View details`                            | 5: Welcome, the Action and its saved variants                  | `design/canvas/components/affected/direct`                                                         |
| Removal              | The Action's saved variant Compact was removed, and so was Farewell, a screen that rendered the Action                                   | 2: Farewell and Compact                                        | `design/canvas/components/removed` and its variants                                                |
| Handbook removal     | Example's `Handbook` folder was removed with its four pages                                                                              | 4: Getting started, Field guide, Printing tips and Style notes | `design/canvas/outcomes/removed-document` and its variants, except `light-only`                    |
| Variant removal      | Welcome's saved variant `Save failed` was removed                                                                                        | 1: Save failed                                                 | `design/canvas/outcomes/removed-variant` and its variant                                           |
| Light-only removal   | Payment terms was removed after the catalogue enabled Dark, so its previous version has a light render only                              | 1: Payment terms                                               | `design/canvas/outcomes/removed-document/light-only`                                               |
| Light-only catalogue | The catalogue rendered Light and Dark at the branch point and renders Light only now, and the Action's saved variant Compact was removed | 14: the 13 entries that lost their dark render, and Compact    | `design/canvas/stage/document/light-only`                                                          |
| Stylesheets          | `generated/styles.css` changed styles of Welcome, and `generated/excluded.css` changed styles that apply to neither Welcome nor Details  | 1: Welcome                                                     | `design/canvas/evidence/styles` and its `excluded` variant, and `design/canvas/evidence/unchanged` |
| Unresolved styles    | `generated/styles.css` changed in a way that can apply anywhere on Welcome                                                               | 1: Welcome                                                     | `design/canvas/evidence/styles/unresolved`                                                         |
| Unnamed styles       | The same reach, from a changed rule that names no style                                                                                  | 1: Welcome                                                     | `design/canvas/evidence/styles/unnamed`                                                            |
| Action styles        | Only `styles/actions.css` changed, and none of its changed styles apply to the Action                                                    | 0                                                              | `design/canvas/evidence/unchanged/action`                                                          |
| Handbook             | One `.action` rule and the Getting started page's own stylesheet changed                                                                 | 5: the page, the Action and its saved variants                 | `design/canvas/evidence/page` and its variant                                                      |
| Excluded content     | Only the content of Welcome's navigation changed, which the example excludes from comparisons                                            | 0                                                              | `design/canvas/evidence/ignored`                                                                   |
| No changes           | Nothing changed                                                                                                                          | 0                                                              | `design/canvas/loading/changes/empty`                                                              |

The handbook removal lists its four pages flat in Changes, because their
folder is gone. On the light-only catalogue branch, the removed Compact's
previous version keeps its dark render, so the shell still offers Dark.

`design/canvas/loading/changes` and its `preparing` and `unavailable` variants
depict Changes before a comparison result, so no entry carries a change
status. `design/canvas/loading/changes/without-changes` depicts a catalogue
built without comparison data, and the startup states depict the shell before
any catalogue arrives.

## Canvas States

The Canvas states of the canonical branch depict these entries:

- Welcome, which the branch changed, stands on the overview as four frames,
  with its Changes tab and the five compare modes. It is also the subject of
  the selection, the tag search and the entry loading states.
- Details, which the branch added, depicts an added entry, whose Changes tab
  offers Current alone. It is also the subject of screen inspection.
- Profile, which the branch did not modify and which renders in Light only,
  depicts an entry with the Inspect tab alone and the Light frames alone.
- Payment terms, which moved unchanged, opens as one reading frame, and its
  right panel also has Changes.
- Invoice, which moved with edits, compares in Overlay on its Light frames
  with the version at its previous path.
- The Action and the Toolbar, two unmodified components, open as their variant
  sets, and the Props states edit and show the Action's saved variants.
- The Example tour, a use case whose steps are Welcome and Details, opens as
  one section of step frames. Its right panel holds Inspect alone.
- The five removed screens open their previous versions: Farewell on its
  Changes tab and on Inspect, the Survey as a long screen, Invite while its
  previous version loads, Archive after the request failed, and Timeline,
  which has no mobile view, on Inspect.

## Transitions

These transitions follow the [design links contract](./mokly-design-links.md).
Canvas links stay inside the Canvas family. A control opens the Canvas
artboard that shows its outcome, and a control without one is a picture of
itself:

- From All, Welcome opens `design/canvas/overview`, Details
  `design/canvas/outcomes/added`, Profile `design/canvas/inspect/unchanged`,
  Payment terms `design/canvas/stage/document`, the Action
  `design/canvas/stage/component-set`, the Toolbar
  `design/canvas/stage/component-set/toolbar` and the Example tour
  `design/canvas/flows/tour`. The other rows, such as the README's `Overview`
  and `Getting started`, are pictures.
- In Changes, `Invoice · Moved` opens `design/canvas/outcomes/moved`, or
  `design/canvas/outcomes/moved/inspect` from an artboard on the Inspect tab,
  and `Payment terms · Moved` opens `design/canvas/stage/document`.
  `Farewell · Removed` opens `design/canvas/outcomes/removed`, or
  `design/canvas/outcomes/removed/inspect` from an artboard on the Inspect
  tab. The rows of Survey, Invite, Archive and Timeline open the `long`,
  `loading`, `unavailable` and `no-view` states of
  `design/canvas/outcomes/removed`. The `Overdue · Moved` row is a picture.
- The moved Invoice's Related docs row opens `design/canvas/stage/document`.
  The stepper's Previous change and Next change open the Changes artboards of
  Welcome, Details, Invoice, Farewell, Survey, Invite and Archive in the order
  of the Changes filter. A control whose neighbour has no Changes artboard,
  such as Payment terms before Farewell or Timeline after Archive, is a
  picture.
- The brand opens `design/canvas/stage/home`. The top bar's menu and the dock's
  Catalogue open `design/canvas/stage/catalogue`, whose All filter returns to
  `design/canvas/overview`. On the canonical branch, the All filter of a
  removed screen's artboard opens `design/canvas/stage/home`, because the
  removed entry is not in All.
- Welcome's Changes tab opens `design/canvas/changes/current`, each compare
  mode opens the Welcome artboard of that mode, and the Inspect tab there
  returns to the overview. Details' tabs move between
  `design/canvas/outcomes/added` and `design/canvas/outcomes/added/changes`,
  and Farewell's between `design/canvas/outcomes/removed` and
  `design/canvas/outcomes/removed/inspect`.
- In the use case, a step's title opens the artboard of its screen: Welcome
  opens `design/canvas/overview` and Details `design/canvas/outcomes/added`.
  The `Used by` chips of Welcome and Details open `design/canvas/flows/tour`.
- Zoom in on the overview opens `design/canvas/stage/zoomed`, whose Fit
  returns to the overview. Every other Fit opens its own fitted artboard.
- An instance in a component tree, a highlight label and a variant in Inspect
  open the artboard that shows that selection. A sheet's close opens the
  artboard that shows the sheet closed.
- Payment terms has no Changes artboard, so its Changes tab is a picture.
- On a branch of its own, a row or a control opens an artboard of that branch,
  and every other row or control is a picture.

The kept tag picker screen links into the Canvas family too. A control opens
the Canvas artboard of the entry that it names, and a control that names an
entry that no artboard shows is a picture.

## Related Docs

- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Design mockup links](./mokly-design-links.md)
- [Folders](./mokly-folders.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Markdown documents](./mokly-documents.md)
- [Moves](./mokly-moves.md)
- [Removed content previews](./mokly-removed-previews.md)
