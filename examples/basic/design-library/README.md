# Design Library Stylesheets

This folder holds one stylesheet for each component of the
[shared design components](../specs/design/library/README.md), as
`{group}/{slug}.css`. The shared, layout and global design rules stay in the
`design*.css` files beside this folder.

[`style_files.ts`](../specs/design/library/style_files.ts) names each
component's public stylesheet, `design-library/{group}/{slug}.css`, relative
to the configuration file, and
[`metadata.ts`](../specs/design/library/metadata.ts) declares it through
`stylesheets`. For a component that `@mokly/ui` provides, that sheet only
imports the package's source
stylesheets by their repository paths, plus mockup-only rules such as the
compact and drawer flags. CSS Changes uses own-page matches
kept after nested-component filtering, not file ownership or source paths.
Shared helpers and saved fixtures are metadata or rendered-output inputs, not
independent comparison evidence.

Rendered components link their declared files in first-render order.
The shared preview layout reserves intrinsic mobile widths so full-size phones
cannot overlap desktop frames when Both is selected.
The phone notch and home pill are decorative and ignore pointer events, so
they cannot intercept interactions with the caller-owned screen below them.
The configuration orders shared base styles first, the `$componentStylesheets`
marker next, then context/layout overrides. Keep this explicit order: equal-specificity
mobile rules must not override bounded workspace scrolling.
The Rust core writes each document head. It links the declared files at the
marker of the first matching rule, or after that rule's shared entries when
the rule has no marker. A closed picker draws no chip, so it does not link chip
CSS merely because another variant uses chips.

Keep component selectors in its declared stylesheet. Tokens, resets, mixed
selectors and cross-component layout/state rules stay in the shared design CSS.
The shared design CSS also imports the package stylesheets of the parts that
the artboard scaffolds render. `design.css`, which every design route links,
imports the theme and the reset class first and then Geist from
`design-fonts/`. `design-preview.css` holds the preview tokens that a depicted
document reads and imports the highlight's labels and mask: the Canvas route
links it, and `design-stage.css` imports it for the library route and for the
`design/**` route of the kept tag picker screen. On those two routes,
`design-component-workspace.css` imports the shell and workspace layouts
after the component sheets, as the package's `styles.css` orders them.

The `design/canvas/**` route links the Canvas viewer's shared sheets in this
order: `design.css`, `design-preview.css`, `design-shots.css` with the mini
screen sketches that a frame holds, and `design-canvas.css`, which holds the
roles that the Canvas palette lacks and the stage. Then come
`design-canvas-inspect.css`, Inspect's sections; `design-canvas-sections.css`,
the sections that a selection and an unfolded section fill, which imports the
package stylesheets of the instance tree, the supplied props, the usage list,
and the props form; and `design-canvas-changes.css`, the Changes tab's
Compared rail and comparison details and Side by side on the stage. One sheet
for the states of each Canvas folder follows: `design-canvas-outcomes.css`,
`design-canvas-flows.css`, `design-canvas-loading.css`,
`design-canvas-search.css`, `design-canvas-components.css`,
`design-canvas-props.css` and `design-canvas-evidence.css`.
`design-documents.css` sets the Markdown of a
reading frame. After the `$componentStylesheets` marker,
`design-canvas-shell.css` imports the shipped shell layout and holds the
shell's layout and the package parts that it restyles, and
`design-canvas-compact.css` holds its compact form. The Canvas route links no
sheet that only the kept older screen needs.

The Canvas part sheets under `canvas/`, `panels/`, `inspector/frames-filter.css`,
and `inspector/box-model.css` read the `--cv-*` roles, and a frame's document
reads the preview tokens of its own scheme; a selection's handles and the
Swipe divider's line and grip take the surface of the document under them.
`canvas/canvas-frame.css` imports the package stylesheets of the comparison
panes and stage, whose stacked layers a frame holds in a comparison. No
Canvas sheet names a colour: a role that the Canvas palette lacks mixes
Canvas roles with `color-mix()`.

`design-canvas-changes.css` sets the shipped comparison evidence in Inspect's
type without the evidence's package stylesheet. No design sheet imports that
stylesheet.

Keep shared host resets at zero specificity so component styles render
identically in standalone samples and in-screen compositions.
Declared sheets reload automatically in Serve, including after an edit.
