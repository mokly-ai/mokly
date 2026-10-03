# Protocol

These documents define Mokly's implemented pre-release contract unless a
Delivery Status names an approved active-plan target. The
[id-derived routes plan](../../plans/id-derived-routes.md) defines the
identity-only formats: paths derive from kind and id, and variants are entries.

Protocol documents state the contract and current delivery status, but never
record which plan milestone delivered a rule; plans keep that history.
`tests/protocol_doc_history.test.ts` enforces the boundary outside `fixtures/`
by rejecting the case-insensitive pattern `\bmilestones?\s+\d`.

## Delivery Status

Uniform CSS attribution, root boundaries, evidence fields and stylesheet-owner
warnings are planned for [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
Comparison details are planned for [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence). Unreleased v8/v4/v5 change in place.

The remaining contract is implemented.

## Graceful Handling

Mokly stops a build only when it cannot make correct, safe output, or when an
input has two possible meanings. When an input is not necessary, or disagrees
with a more specific input, Mokly uses the more specific input and continues.
When Mokly ignores an input that the author wrote, it shows a warning. The
[build warning contract](./mokly-build-warnings.md) defines collection,
deduplication and terminal presentation for the affected cases. This rule does
not waive public-file confinement, source protection or validation of the
inputs Mokly actually uses. The current plan applies it to duplicate component
CSS declarations, configured-link placement, configured/declared overlap,
renderer ownership for every stylesheet, and the removed authoring/configuration
fields; other validation contracts are unchanged.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 8                  | 5                 |
| With registered components    | 8                  | 5                 |

Manifest v8 carries pages, navigation paths, the source inventory, flattened component variants and per-view usage, without author-maintained path evidence or derivable paths. Every catalogue emits comparison v5. The public catalogue read model is v4; the static delivery descriptor remains v3.

Current manifest readers require v8. Historical readers accept v3 to v7, drop collection records and strip removed fields before validation and comparison. Public readers reject catalogue v1 to v3 and comparison v4 and earlier; regenerate those exports.

## Contracts

- [CI verification](./ci-verification.md) — implemented suite, shard, evidence,
  cache and aggregation contract.
  - [CI dependency cache and security](./ci-verification-security.md).
  - [Repository gate and length audits](./ci-verification-repository.md).
- [CI workflow graph](./ci-workflow.md)
- [CI suite evidence](./ci-suite-evidence.md) — fixture cleanup, browser shard
  balance, and acceptance measurement.
- [Repository verification ratchets](./verification-ratchets.md)
- [Catalogue upload v1](./mokly-upload.md) — public CLI, repository identity,
  upload manifest, output entry point and composite action boundary.
- [Catalogue upload exchange v1](./mokly-upload-exchange.md) — Plan, Blob and
  Complete requests, retries, expiry, and accounting.
- [Catalogue upload validation v1](./mokly-upload-validation.md) — rejection
  categories, limits, and independent receiver validation.
- [Package and authoring contract](./mokly-package.md)
- [CLI terminal output](./mokly-terminal-output.md) — plain compatibility,
  interactive progress, watched events, and shortcuts.
- [CLI terminal compatibility and errors](./mokly-terminal-errors.md) — exact
  plain output and rich error presentation.
- [Build warnings](./mokly-build-warnings.md) — ignored-input diagnostics and invocation deduplication.
- [Packaged CLI guides](./mokly-guides.md) — versioned Markdown consumed by the
  cloud documentation site.
- [Configuration contract](./mokly-configuration.md) — includes public-exclusion validation and defaults.
  - [Entry discovery and public exclusions](./mokly-configuration-discovery.md).
  - [Imported CSS configuration](./mokly-configuration-imported-styles.md).
- [Public authoring API](./mokly-authoring.md)
- [Nested authoring trees](./mokly-nested-authoring.md)
- [Identity-derived artifact paths](./mokly-artifact-paths.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Component-declared stylesheets](./mokly-component-stylesheets.md) — implemented
  link placement, validation, provenance, watching and delivery.
- [Component stylesheet ownership and comparison](./mokly-component-stylesheet-ownership.md)
  — final-link provenance, ignored CSS owners and comparison exclusion.

  - [Generated rendering contract](./mokly-rendering-generated.md).

- [Build and Browse runtime](./mokly-runtime.md)
- [Navigation disclosure persistence](./mokly-disclosure-persistence.md) —
  storage, defaults, watched recovery, and in-place reconciliation.
- [Component instance identity](./mokly-instances.md) — existing key/boundary
  rules and approved resolution/source-location target.
- [Public catalogue read model v4](./mokly-catalogue.md) — identity-only public
  inventory beside the private manifest.
  - [Catalogue projection and delivery](./mokly-catalogue-delivery.md) — privacy,
    canonical bytes, version admission and atomic live revisions.
- [Navigation paths and folders](./mokly-nav-paths.md) — section trees, path
  diagnostics, sibling order, and folder keys.
- [Standalone shell bootstrap](./mokly-shell-bootstrap.md) — entry-scoped Serve
  hydration, strict reading, evidence adoption, and static capture.
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
- [Pages in the catalogue](./mokly-pages.md)
- [Variants](./mokly-variants.md) — screen and component variants as entries
  with their own global ids, derived routes, and `variantOf`, grouped under
  their parent.
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Source protection](./mokly-source-protection.md)
- [Imported stylesheets](./mokly-imported-styles.md) — implemented:
  renderer/entry CSS, CSS Modules, assets, PostCSS, inventory, and
  [exact diagnostics](./mokly-imported-styles-errors.md).
  - [CSS Modules and rename-only verification](./mokly-imported-styles-modules.md).
  - [PostCSS and dependency inventory](./mokly-imported-styles-postcss.md).
  - [Assets, links and delivery](./mokly-imported-styles-assets.md).
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Baseline compatibility](./mokly-baseline-compatibility.md)
- [Optional changes in publication](./mokly-publication.md)
  - [Published Changes and acceptance](./mokly-publication-changes.md).
- [Changes and screen comparisons](./mokly-changes.md)
  - [Changes serving and comparison](./mokly-changes-serving.md).
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
- [Removed preview acceptance](./mokly-removed-preview-acceptance.md) —
  regression and presentation coverage.
- [Derived baselines](./mokly-derived-baselines.md) — default uncommitted
  generated output with per-commit rebuilt baselines.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive
    limits, command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Current manifest v8 schema](./mokly-component-manifest.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Component comparison v5 schema](./mokly-component-review.md)
- [Component review validation and canonical output](./mokly-component-review-validation.md)
- [Design component attribution](./mokly-design-component-attribution.md) — CSS delivery and caller-input acceptance.
- [Component change attribution](./mokly-component-changes.md)
- [CSS change attribution](./mokly-css-attribution.md) — implemented
  rule-aware stylesheet evidence.
  - [CSS rule membership and identity](./mokly-css-attribution-rules.md).
  - [CSS attribution membership and evidence](./mokly-css-attribution-membership.md).
- [Component review fast path](./mokly-component-review-fast-path.md)
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
- [Consumer static export](./mokly-export.md) — consumer CLI and
  transactional artifact-generation contract.
  - [Export public files and package boundary](./mokly-export-public-files.md).
- [Static export safety](./mokly-export-safety.md) — output confinement and
  ownership reservations.
- [Static export delivery](./mokly-export-delivery.md) — portable
  hosting, navigation, and comparison behavior.
- [Static export browser and identity](./mokly-export-browser.md) — browser
  modules and deployment identity.
- [Export recovery](./mokly-export-recovery.md) — backup ownership,
  concurrent destination changes, bounded cleanup, and failure reporting.
- [Export ownership v2](./mokly-export-ownership.md) — public per-file digest
  inventory and compatibility fixtures for independent upload receivers.
- [Watched development](./mokly-watch.md)
  - [Watch runtime and recovery](./mokly-watch-runtime.md).
- [Catalogue navigation contract](./mokly-navigation.md)
- [Styled catalogue link controls](./mokly-link-controls.md)
- [Shell design contract](./mokly-shell-design.md)
- [Design mockup links](./mokly-design-links.md)
- [Registered components in Mokly's design catalogue](./mokly-design-components.md)
  — implemented shared design components and ownership rules, with the
  [component library inventory](./mokly-design-component-library.md).
- [CI and npm release contract](./npm-release.md)
  - [npm release management](./npm-release-management.md).
  - [npm release operations](./npm-release-operations.md)
  - [npm breaking-change release notes](./npm-release-notes.md)
  - [Repository preview deployments](./npm-preview-deployments.md)
  - [Release verification evidence](./npm-release-evidence.md)
  - [One-time registry bootstrap](./npm-bootstrap.md)
  - [GitHub publishing protections](./npm-github-protections.md)
- [Dependency security](./dependency-security.md) — advisory gates, targeted
  updates, temporary overrides, and packed-consumer audit coverage.
