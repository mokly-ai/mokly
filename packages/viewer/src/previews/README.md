# Previous versions of removed entries

These modules turn a removed page or screen into the version from the pinned
Changes baseline, for the served shell, a static export and an embedded
`@mokly/viewer` alike. They implement the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md).

`descriptor.ts` reads the stage host's `data-mokly-preview` attribute that
`shell/previews.tsx` renders. A damaged or unknown descriptor advertises
nothing, so the stage reports the unavailable state instead of requesting an
address the catalogue never published.

`request.ts` resolves that descriptor to one address. Development uses the
stable selected endpoint (`route=` for a screen, `page=` for a page); static
delivery uses `comparisonUrl` for a screen and the catalogue's advertised
`preview.path` for a page, after checking that the path belongs to the
comparison's generation and to this exact route. A page's documents resolve
against the generation root, not the descriptor's own directory. Screen views
render only where the comparison says `removed`; any `afterPath` for that route
means a reused generation and is treated as unavailable. `renewPreview`
extends a live generation's retention before reusing it, exactly as comparisons
do. `advertisedPreviewPaths` is the complete set an embedded viewer may fetch.

`copy.ts` owns the unavailable copy and Retry hook shared by the served shell
and client renderer. `render.ts` owns the loading, client-side
unavailable-with-retry and loaded stages, cloning the device chrome the shell
rendered into templates. A selected viewport with no captured view keeps a note
where its frame would be rather than an empty stage; its `mbk-preview-note` and
`mbk-preview-switch` classes match the design catalogue, and the stylesheet
hides the closing sentence while both viewports are shown. `read_only.ts`
cancels link and form activation inside frames the parent can reach, Enter
included, while preserving scrolling, selection and same-document anchors;
Space keeps its default so a long previous version stays readable from the
keyboard, and a cross-origin preview relies on its sandbox instead. `install.ts`
is the delegated controller: its first update replaces the shell's served
unavailable stage with the loading state, then it requests on selection, renews
before re-rendering a viewport or theme change, and discards any response whose
stage or entry has since changed.

The browser build exposes this controller as `client/previews.js`. Browse
imports that module instead of bundling it into `browse_runtime.js`, and the
controller imports `parseReviewResult` from the existing `diffs.js` module.
Serve and static export explicitly ship the resulting graph. The packaged
`@mokly/viewer` browser build uses the same graph without changing preview
behavior.

```bash
npm run build
npx tsx --test tests/client_removed_previews.test.ts tests/removed_preview_shell.test.ts
npx playwright test tests/browser/removed_previews.spec.ts tests/browser/removed_preview_views.spec.ts tests/browser/removed_previews_static.spec.ts tests/browser/removed_previews_viewer.spec.ts
```

Related boundaries: [the Browse client](../client/README.md), the
[shared shell](../shell/README.md), and the
[selected comparison contract](../../../../docs/protocol/mokly-selected-comparisons.md).
