# Protocol

These documents define Mokly's implemented pre-release contract unless a
Delivery Status names an approved active-plan target. The
[id-derived routes plan](../../plans/id-derived-routes.md) defines the
identity-only formats: paths derive from kind and id, and variants are entries.

## Delivery Status

The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md) is
the approved pending target: M2 diagnostics/fixture identity, M3 bounded memory,
M4 parse reuse, M5 residual analysis, M7 page analysis, M8 the style-only route,
and M9 fingerprints. Each owning contract below links its delivery step;
M10 removes pending schedules after implementation and acceptance.

Protocol documents state the contract and current delivery status. Pending
Delivery Status schedules may link future plan steps as `M2`, `M3`, etc.; remove
those schedules when the plan finishes. Never record delivered-step history;
plans keep that history.
`tests/protocol_doc_history.test.ts` enforces the boundary outside `fixtures/`
by rejecting the case-insensitive pattern `\bmilestones?\s+\d`.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 7                  | 4                 |
| With registered components    | 7                  | 4                 |

Manifest v7 carries explicit pages, `navPath`, source inventory, declared
dependencies, component variants, and per-view usage, but no derivable path.
Review result v4 addresses entries and views by identity and axes. The public
read model and static delivery descriptor are v3. Current and baseline manifest
readers accept only v7; earlier output follows
[baseline compatibility](./mokly-baseline-compatibility.md).

## Contracts

- [CI verification](./ci-verification.md)
- [CI workflow graph](./ci-workflow.md)
- [Repository verification ratchets](./verification-ratchets.md)
- [Catalogue upload v1](./mokly-upload.md) — public CLI and hosted/self-hosted
  receiver boundary.
- [Package and authoring contract](./mokly-package.md)
- [CLI terminal output](./mokly-terminal-output.md) — plain compatibility,
  interactive progress, errors, watched events, and shortcuts.
- [Packaged CLI guides](./mokly-guides.md) — versioned Markdown consumed by the
  cloud documentation site.
- [Configuration contract](./mokly-configuration.md) — includes public-exclusion
  validation and defaults.
- [Public authoring API](./mokly-authoring.md)
- [Nested authoring trees](./mokly-nested-authoring.md)
- [Identity-derived artifact paths](./mokly-artifact-paths.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Navigation disclosure persistence](./mokly-disclosure-persistence.md) —
  storage, defaults, watched recovery, and in-place reconciliation.
- [Component instance identity](./mokly-instances.md) — existing key/boundary
  rules and approved resolution/source-location target.
- [Public catalogue read model v3](./mokly-catalogue.md) — identity-only public
  inventory beside the private manifest.
- [Navigation paths and folders](./mokly-nav-paths.md) — section trees, path
  diagnostics, sibling order, and folder keys.
- [Embeddable viewer](./mokly-viewer.md) — approved `@mokly/viewer` API and
  shared hydrated shell.
- [Live viewer capabilities](./mokly-live-capabilities.md) — private Serve
  evidence, updates, recovery, previews and on-demand rendering for React.
- [Viewer appearance](./mokly-viewer-appearance.md) — implemented
  Auto/Light/Dark support: one standalone Appearance control and a host-supplied
  embedded theme beside independent preview controls.
- [Viewer semantic palette](./mokly-viewer-palette.md) — Light and Dark
  swatches, recorded contrast and the Light corrections they required.
- [Mokly shell brand](./mokly-shell-brand.md) — package-owned mark, wordmark,
  responsive presentation, and palette boundary.
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md) —
  host-owned anchored content and exact atomic highlight behavior.
- [Viewer frame adapter](./mokly-frame-adapter.md) — approved same-origin
  interface and cross-origin inspector protocol v1.
- [Published inspector and overlay](./mokly-published-inspector.md) — static
  injection, inert metadata, style isolation, and script budget.
- [On-demand Serve](./mokly-on-demand.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Startup diagnostics and scale fixtures](./mokly-timings.md)
- [Comparison material work counts](./mokly-material-work-counts.md)
- [Pages in the catalogue](./mokly-pages.md)
- [Variants](./mokly-variants.md) — screen and component variants as entries
  with their own global ids, derived routes, and `variantOf`, grouped under
  their parent.
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Source protection](./mokly-source-protection.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Baseline compatibility](./mokly-baseline-compatibility.md)
- [Optional changes in publication](./mokly-publication.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Comparison pane presentation](./mokly-comparison-panes.md) — viewer-owned,
  device-sized Overlay, Difference and Side by side panes.
- [Comparison scrolling](./mokly-comparison-scrolling.md) — page alignment,
  inner-region mirroring, keys, and anchors.
- [Comparison region pairing](./mokly-comparison-region-pairing.md) — how an
  inner scroll region finds its counterpart in another version.
- [Comparison Scroll together](./mokly-comparison-scroll-together.md) — the
  reader control, its preference, and realignment.
- [Removed content previews](./mokly-removed-previews.md) — removed screens and
  pages show their pinned baseline version.
- [Derived baselines](./mokly-derived-baselines.md) — default uncommitted
  generated output with per-commit rebuilt baselines.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive
    limits, command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Current manifest v7 schema](./mokly-component-manifest.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Component comparison v4 schema](./mokly-component-review.md)
- [Component review validation and canonical output](./mokly-component-review-validation.md)
- [Component change attribution](./mokly-component-changes.md)
- [Component review fast path](./mokly-component-review-fast-path.md)
- [CSS parse reuse](./mokly-css-parse-reuse.md) — bounded caches, verified
  segments, rule data and changed-segment policy (approved target)
- [Component-aware page analysis](./mokly-page-analysis.md) — provenance,
  matching, quick checks and fingerprints (approved target)
- [Page source provenance](./mokly-page-source-provenance.md) — extractor
  inventory, adopted attributes and formatting clones
- [Component-aware style-only route](./mokly-style-only-route.md) — conditions,
  equivalent results and fallback (approved target)
- [CSS change attribution](./mokly-css-attribution.md)
- [Inline style resource ownership](./mokly-inline-style-resources.md)
- [Inline style evidence](./mokly-inline-style-evidence.md)
- [Inline style ownership](./mokly-inline-styles.md) — document-derived
  ownership and comparison material for head styles.
- [CSS evidence in the shell](./mokly-css-evidence-shell.md) — inspector and
  comparison-stage presentation of stylesheet evidence.
- [CSS evidence presentation](./mokly-css-evidence-presentation.md)
- [Component pages and screen inspection](./mokly-component-explorer.md)
- [Component explorer design catalogue](./mokly-component-design.md)
- [Component icon inspector design](./mokly-component-inspector-design.md)
- [Component controls design catalogue](./mokly-component-controls-design.md)
- [Component workspace design](./mokly-component-workspace-design.md) (view
  controls, resizing, and comparison eligibility)
- [Component controls](./mokly-component-controls.md)
- [Consumer static export](./mokly-export.md) — consumer CLI and transactional
  artifact-generation contract.
- [Static export delivery](./mokly-export-delivery.md) — portable hosting,
  navigation, and comparison behavior.
- [Export recovery](./mokly-export-recovery.md) — backup ownership, concurrent
  destination changes, bounded cleanup, and failure reporting.
- [Export ownership v1](./mokly-export-ownership.md) — public inventory schema
  and compatibility fixtures for independent upload receivers.
- [Watched development](./mokly-watch.md)
- [Catalogue navigation contract](./mokly-navigation.md)
- [Styled catalogue link controls](./mokly-link-controls.md)
- [Shell design contract](./mokly-shell-design.md)
- [Design mockup links](./mokly-design-links.md)
- [Registered components in Mokly's design catalogue](./mokly-design-components.md)
  — implemented shared design components and ownership rules, with the
  [component library inventory](./mokly-design-component-library.md).
- [CI and npm release contract](./npm-release.md)
  - [npm breaking-change release notes](./npm-release-notes.md)
  - [Repository preview deployments](./npm-preview-deployments.md)
  - [Release verification evidence](./npm-release-evidence.md)
  - [One-time registry bootstrap](./npm-bootstrap.md)
  - [GitHub publishing protections](./npm-github-protections.md)
- [Dependency security](./dependency-security.md) — advisory gates, targeted
  updates, temporary overrides, and packed-consumer audit coverage.
