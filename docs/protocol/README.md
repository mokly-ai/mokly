# Protocol

These documents define Mokly's implemented pre-release contract unless a
Delivery Status names an approved active-plan target. The [path contract](./mokly-paths.md) defines the
path-based formats: every entry is identified by a path derived from its file,
Markdown files are documents, and moves are paired with their baseline.

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS attribution, root boundaries, evidence fields and stylesheet-owner
warnings are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
Comparison details for screens and component saved views are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence);
the whole-document page display is implemented in [M20B](../../plans/remove-source-path-evidence.md#milestone-20b-show-whole-document-page-evidence). Unreleased v8/v4/v5 change in place.

The [id-derived routes plan](../../plans/id-derived-routes.md) records the
identity-only format delivery. The 2026-10-05 decisions are documented in
[M26](../../plans/remove-source-path-evidence.md#milestone-26-document-the-2026-10-05-review-decisions).
The excluded-only mockup and shared Details card are implemented in
[M27](../../plans/remove-source-path-evidence.md#milestone-27-depict-the-excluded-only-stylesheet-state).
Link placement and discovery are implemented in [M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).
Warning generations, startup cleanup and unused-code removal are implemented in
[M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).
The remaining approved work is stronger regression tests with recorded failing-rule runs, the docs guard and
removed-field types in [M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types),
and exported navigation and viewer alignment in
[M31](../../plans/remove-source-path-evidence.md#milestone-31-keep-the-branch-name-in-exported-navigation).

## Current Documentation Rule

Use the [documentation policy](./documentation-policy.md) for status sections and
reviewed exceptions. There is no plan index. Link to `plans/`. Each plan starts
with `Status: Active` or `Status: Completed` directly below its title.

## Graceful Handling

The [graceful-handling rule](./mokly-build-warnings.md#graceful-handling) applies
to safe stylesheet conflicts and the three removed inputs. Removed
Removed `dependencies`, `ownedDependencies` and `review.sharedImpact` warn and have no
effect. Other unknown fields, including former configuration fields, fail
under their owning contract.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 8                  | 5                 |
| With registered components    | 8                  | 5                 |

Current output uses manifest v8, review result v5, and public read model v4,
keyed by kind and path. The private catalogue-change snapshot is v2 and removed
page preview metadata is v3. Delivery descriptors remain v3. The manifest stores
folder records, component variants and per-view usage, root output ranges
and inserted-stylesheet provenance,
with no derivable file names. Markdown documents and their resource copies are
implemented. Accepted move pairs carry `previousPath` in review records and
the public read model; the manifest retains authored hints only.
Current and baseline manifest readers accept only one version; earlier output
follows [baseline compatibility](./mokly-baseline-compatibility.md).

Current and baseline manifest readers require canonical, valid v8 output. Lower integer versions and former-name sentinels make Changes unavailable under the [baseline contract](./mokly-baseline-compatibility.md). No reader converts earlier metadata. Public readers reject catalogue v1 to v3 and comparison v4 and earlier; regenerate those exports.

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
- [Root discovery and ownership](./mokly-root-discovery.md)
- [Package and authoring contract](./mokly-package.md)
- [CLI terminal output](./mokly-terminal-output.md) — plain compatibility,
  interactive progress, watched events, and shortcuts.
- [CLI terminal compatibility and errors](./mokly-terminal-errors.md) — exact
  plain output and rich error presentation.
- [Build warnings](./mokly-build-warnings.md) — ignored-input diagnostics and invocation deduplication.
- [Packaged CLI guides](./mokly-guides.md) — versioned Markdown consumed by the
  cloud documentation site.
- [Configuration contract](./mokly-configuration.md), with [public exclusions](./mokly-public-exclusions.md) for validation, defaults and the public-file matching base.
  - [Entry discovery and public exclusions](./mokly-configuration-discovery.md).
  - [Imported CSS configuration](./mokly-configuration-imported-styles.md).
- [Public authoring API](./mokly-authoring.md)
- [Paths, roots, and identity](./mokly-paths.md) — path derivation, segment
  grammar, index pages, URLs, and collision diagnostics.
- [Folders](./mokly-folders.md) — folder records, titles, order, hidden
  folders, and browse-only folder rows.
- [Entry modules](./mokly-entry-modules.md) — export collection and slugs.
- [Markdown documents](./mokly-documents.md) — discovered Markdown entries.
- [Document rendering safety](./mokly-document-safety.md) — final HTML allowlist and script policy.
- [Moves](./mokly-moves.md) — baseline pairing and `previousPath`.
- [Branch-point entry lookup](./mokly-branch-point-lookup.md) — shared current,
  historical, counterpart and variant-parent resolution.
- [Path-derived artifact paths](./mokly-artifact-paths.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Component-declared stylesheets](./mokly-component-stylesheets.md) —
  link placement, validation, provenance, watching and delivery.
- [Component stylesheet ownership and comparison](./mokly-component-stylesheet-ownership.md)
  — final-link provenance, ignored CSS owners and comparison exclusion.
- [Stylesheet link discovery](./mokly-stylesheet-links.md) — shared finder scopes,
  inert templates and recorded links inside Review-ignore.

  - [Generated rendering contract](./mokly-rendering-generated.md).

- [Build and Browse runtime](./mokly-runtime.md)
- [Navigation disclosure persistence](./mokly-disclosure-persistence.md) —
  storage, defaults, watched recovery, and in-place reconciliation.
- [Component instance identity](./mokly-instances.md) — existing key/boundary
  rules and approved resolution/source-location target.
- [Public catalogue read model](./mokly-catalogue.md) — path-keyed public
  inventory beside the private manifest, with its
  [fetch rules](./mokly-catalogue-fetch.md) and
  [tree and section order](./mokly-catalogue-tree.md) and
  [serialization](./mokly-catalogue-serialization.md).
  - [Catalogue projection and delivery](./mokly-catalogue-delivery.md) — public evidence and privacy.
- [Standalone shell bootstrap](./mokly-shell-bootstrap.md) — entry-scoped Serve
  hydration, strict reading, evidence adoption, and static capture.
- [Embeddable viewer](./mokly-viewer.md) — approved `@mokly/viewer` API and
  shared hydrated shell, with [SSR, hydration, and host independence](./mokly-viewer-ssr.md).
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
  whose path is the parent's path plus a slug, grouped under their parent.
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Source protection](./mokly-source-protection.md), with
  [acceptance checks](./mokly-source-protection-acceptance.md).
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
- [Changes and screen comparisons](./mokly-changes.md), with
  [comparison serving](./mokly-comparison-serving.md) for generation and
  serving rules.
  - [Changes serving and comparison](./mokly-changes-serving.md), with
    [screen controls](./mokly-changes-controls.md).
- [Comparison pane presentation](./mokly-comparison-panes.md) — viewer-owned,
  device-sized Overlay, Difference and Side by side panes, with their
  [design references](./mokly-comparison-pane-designs.md).
- [Comparison scrolling](./mokly-comparison-scrolling.md) — page alignment,
  inner-region mirroring, keys, and anchors.
- [Comparison region pairing](./mokly-comparison-region-pairing.md) — how an
  inner scroll region finds its counterpart in another version.
- [Comparison Scroll together](./mokly-comparison-scroll-together.md) — the
  reader control, its preference, and realignment.
- [Removed content previews](./mokly-removed-previews.md) — removed screens,
  pages, and documents show their pinned baseline version, with
  [preview frames](./mokly-removed-preview-frames.md) for the frame lifecycle.
- [Removed preview acceptance](./mokly-removed-preview-acceptance.md) —
  regression and presentation coverage.
- [Derived baselines](./mokly-derived-baselines.md) — default uncommitted
  generated output with per-commit rebuilt baselines.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive
    limits, command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Manifest schema](./mokly-component-manifest.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Component comparison schema](./mokly-component-review.md)
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
- [Component explorer design catalogue](./mokly-component-design.md), with its
  [screen inventory](./mokly-component-design-inventory.md).
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
- [Catalogue navigation contract](./mokly-navigation.md), with
  [logical link transformer validation](./mokly-link-transform-validation.md)
  and [shell destination queries](./mokly-shell-destinations.md).
- [Styled catalogue link controls](./mokly-link-controls.md)
- [Shell design contract](./mokly-shell-design.md), with
  [device chrome and preview scheme](./mokly-shell-device-chrome.md), the
  [design screen inventory](./mokly-shell-design-inventory.md), and the
  [depicted design catalogue](./mokly-shell-design-catalogue.md).
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
  updates, temporary patched-release overrides, reviewed path exceptions, and
  strict packed-consumer audit coverage.
