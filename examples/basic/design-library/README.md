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
Keep shared host resets at zero specificity so component styles render
identically in standalone samples and in-screen compositions.
Declared sheets reload automatically in Serve, including after an edit.
