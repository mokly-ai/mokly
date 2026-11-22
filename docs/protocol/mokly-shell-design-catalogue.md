# Depicted Design Catalogue

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
- Inspect's Path row and the path chips of the kept screens show paths such
  as `example/screens/welcome`. A component's details add the shown entry's
  path, a document's details name its Markdown source, and a moved entry's
  details add a `Moved from` row with its previous path.

## Depicted Branches

- The canonical branch changed Welcome, added Details, moved `billing` under
  `account`, and removed five screens, so Changes counts ten entries. Invoice
  moved with edits; its Overdue variant and Payment terms moved unchanged.
  Each keeps one row labelled `· Moved` at its new place. The
  [Canvas states](#canvas-states) browse this branch, and so do the kept use
  case and its flow, the kept tag picker and the kept removed screens.
- `design/browse/variants/variant-removed` depicts a branch that removed
  Welcome's `Save failed` variant, so its filter counts one entry.
- `design/browse/appearance/states/light-only-document` depicts a branch that
  removed Payment terms after the catalogue enabled Dark. Its previous version
  has only a light render, and Changes counts one entry,
  `Payment terms · Removed`. Under Dark its pane keeps the Light palette and
  its label reads `Showing previous version — Light only`; its All filter
  opens `design/canvas/overview`.

The Canvas states that the canonical branch cannot show depict branches of
their own:

| Branch            | Change                                                                                                                                  | Changes count                                  | Canvas states                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Action            | The Action's render changed the corners and the padding of its button                                                                   | 4: the Action and its three saved variants     | `design/canvas/components/compare`, `usage`, `affected` and their variants, except `direct`        |
| Direct change     | The Action branch's change, and Welcome changed the label of its own Action from `Continue` to `View details`                           | 5: Welcome, the Action and its saved variants  | `design/canvas/components/affected/direct`                                                         |
| Removal           | The Action's saved variant Compact was removed                                                                                          | 1: Compact                                     | `design/canvas/components/removed` and its variant                                                 |
| Stylesheets       | `generated/styles.css` changed styles of Welcome, and `generated/excluded.css` changed styles that apply to neither Welcome nor Details | 1: Welcome                                     | `design/canvas/evidence/styles` and its `excluded` variant, and `design/canvas/evidence/unchanged` |
| Unresolved styles | `generated/styles.css` changed in a way that can apply anywhere on Welcome                                                              | 1: Welcome                                     | `design/canvas/evidence/styles/unresolved`                                                         |
| Unnamed styles    | The same reach, from a changed rule that names no style                                                                                 | 1: Welcome                                     | `design/canvas/evidence/styles/unnamed`                                                            |
| Action styles     | Only `styles/actions.css` changed, and none of its changed styles apply to the Action                                                   | 0                                              | `design/canvas/evidence/unchanged/action`                                                          |
| Handbook          | One `.action` rule and the Getting started page's own stylesheet changed                                                                | 5: the page, the Action and its saved variants | `design/canvas/evidence/page` and its variant                                                      |
| Excluded content  | Only the content of Welcome's navigation changed, which the example excludes from comparisons                                           | 0                                              | `design/canvas/evidence/ignored`                                                                   |
| No changes        | Nothing changed                                                                                                                         | 0                                              | `design/canvas/loading/changes/empty`                                                              |

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

## Transitions

These transitions follow the [design links contract](./mokly-design-links.md).
Canvas links stay inside the Canvas family. A control opens the Canvas
artboard that shows its outcome, and a control without one is a picture of
itself:

- From All, Welcome opens `design/canvas/overview`, Details
  `design/canvas/outcomes/added`, Profile `design/canvas/inspect/unchanged`,
  Payment terms `design/canvas/stage/document`, the Action
  `design/canvas/stage/component-set` and the Toolbar
  `design/canvas/stage/component-set/toolbar`. The other rows, such as the
  README's `Overview`, `Example tour` and `Getting started`, are pictures.
- In Changes, `Invoice · Moved` opens `design/canvas/outcomes/moved`, or
  `design/canvas/outcomes/moved/inspect` from an artboard on the Inspect tab,
  and `Payment terms · Moved` opens `design/canvas/stage/document`. The
  `Overdue · Moved` row and the rows of the removed screens are pictures.
- The moved Invoice's Related docs row opens `design/canvas/stage/document`.
  The stepper's Previous change and Next change open the Changes artboards of
  Welcome, Details and Invoice in the order of the Changes filter.
- The brand opens `design/canvas/stage/home`. The top bar's menu and the dock's
  Catalogue open `design/canvas/stage/catalogue`, whose All filter returns to
  `design/canvas/overview`.
- Welcome's Changes tab opens `design/canvas/changes/current`, each compare
  mode opens the Welcome artboard of that mode, and the Inspect tab there
  returns to the overview. Details' tabs move between
  `design/canvas/outcomes/added` and `design/canvas/outcomes/added/changes`.
- Zoom in on the overview opens `design/canvas/stage/zoomed`, whose Fit
  returns to the overview. Every other Fit opens its own fitted artboard.
- An instance in a component tree, a highlight label and a variant in Inspect
  open the artboard that shows that selection. A sheet's close opens the
  artboard that shows the sheet closed.
- Payment terms has no Changes artboard, so its Changes tab is a picture.
- On a branch of its own, a row or a control opens an artboard of that branch,
  and every other row is a picture.

The kept screens link into the Canvas family too. A control opens the Canvas
artboard of the entry that it names, and a control that names an entry that
no artboard shows is a picture. The links between the kept removed entries
stay among them. Folder crumbs and a parent entry's crumb stay text on
removed entries.

## Related Docs

- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Design mockup links](./mokly-design-links.md)
- [Folders](./mokly-folders.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Markdown documents](./mokly-documents.md)
- [Moves](./mokly-moves.md)
