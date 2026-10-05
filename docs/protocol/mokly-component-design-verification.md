# Component Design Verification

Companion to the [component design contract](./mokly-component-design.md).

## Verification And Maintenance

Use the real generator; never hand-edit generated HTML. Six shared component
stylesheets are hand-authored public inputs, scoped to the component design
entries' generated documents.
Route-scoped stylesheet matching links them only from the thirty-nine component design routes;
Changes follows those rendered resources. Shared metadata supplies dependency
lists to each definition. Controls extends that list with its own stylesheet,
scoped to eleven entries with a matching watch rule. Keep those stylesheets out
of global `review.sharedImpact`; watched rules still reload their edits.

The three Static/Live workspace screens and the rebuild-status Live component
screen also use the shared component styles and declare their dependencies.
Shared fixtures and reusable screen parts live beside the owning screen modules.

`tests/component_design_attribution.test.ts` exercises each component stylesheet
against the real example configuration and current compiled manifest through the rendered-resource graph and changed-entry projection. It requires exact
Changes membership for the component design entries, excluding unrelated design screens,
product screens, and their use case.

Run `npm run example:build`, `npm run example:check`, and
`npx playwright test tests/browser/component*.spec.ts tests/browser/design_component_stacks.spec.ts`.
The browser suite opens every artboard directly from disk, checks links,
selection semantics, counts, missing states, responsive overflow, mask
geometry, and the stacked frames' layers, blending, single scroller and drawn
offset; `tests/design_component_stacks.test.ts` pins their structure,
`tests/design_component_comparison_states.test.ts` ties every comparison
caption to its recorded change and pins the Checklist's Changes, and
`tests/design_screen_counts.test.ts` keeps the documented screen counts
aligned with the catalogue. Visually inspect
all generated mobile and desktop pages, including both selected-instance states.
Run `cargo xtask check` before committing and pushing. After the push, use the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main` and report findings without changing the implementation.
