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
the artboard scaffolds render in every family: `design.css` imports the theme
and the reset class first, `design-component-workspace.css` the shell and
workspace layouts after the component sheets, as the package's `styles.css`
orders them, and `design-stage.css` the highlight's labels and mask.

The Canvas viewer's shared sheets follow the same order, through the sheets
that every design route links: `design-stage.css` imports `design-canvas.css`,
which imports Geist from `design-fonts/` and holds the roles that the Canvas
palette lacks and the stage, `design-canvas-inspect.css`, Inspect's sections,
`design-canvas-sections.css`, the sections that a selection and an unfolded
section fill, which imports the package stylesheets of the instance tree, the
supplied props, the usage list, and the props form, as
`design-component-details.css` does for the component designs, and
`design-canvas-changes.css`, the Changes tab's Compared rail and comparison
details and Side by side on the stage; `design-component-workspace.css`
imports `design-canvas-shell.css`, the shell's layout and the package parts
that it restyles, and then `design-canvas-compact.css`, its compact form. The
Canvas part sheets under `canvas/`, `panels/`, `inspector/frames-filter.css`,
and `inspector/box-model.css` read the `--cv-*` roles, and a frame's document
reads the preview tokens of its own scheme; a selection's handles and the
Swipe divider's line and grip take the surface of the document under them.
`canvas/canvas-frame.css` imports the package stylesheets of the comparison
panes and stage, whose stacked layers a frame holds in a comparison. No
Canvas sheet names a colour: a role that the Canvas palette lacks mixes
Canvas roles with `color-mix()`.

The Changes tab sets the shipped comparison evidence in Inspect's type from
`design-canvas-changes.css` without its package stylesheet: every design
route links the shared sheets, and the Browse designs that draw the evidence
link no evidence sheet, so importing it there would restyle them.
Keep shared host resets at zero specificity so component styles render
identically in standalone samples and in-screen compositions.
Declared sheets reload automatically in Serve, including after an edit.
