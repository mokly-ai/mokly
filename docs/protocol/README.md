# Protocol

These documents define Mokly's implemented pre-release contract, except for
approved active-plan targets named by Delivery Status. The [path identity plan](../../plans/path-identity.md)
defines file-derived entry paths, Markdown documents and baseline-paired moves.

Protocol documents state the contract and current delivery status, but never
record which plan milestone delivered a rule; plans keep that history.
`tests/protocol_doc_history.test.ts` enforces the boundary outside `fixtures/`
by rejecting the case-insensitive pattern `\bmilestones?\s+\d`.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 9                  | 6                 |
| With registered components    | 9                  | 6                 |

Current output uses manifest v9, review result v6, and public read model v5,
with globally unique entry paths. The private catalogue-change snapshot is v3 and removed
page preview metadata is v3. Delivery descriptors are v5. The manifest stores
folder records, declared dependencies, component variants and per-view usage,
with no derived file names on entries; the generated inventory lists exact paths. Markdown documents and their resource copies are
implemented. Accepted move pairs carry `previousPath` in review records and
the public read model; the manifest retains authored hints only.
Current and baseline manifest readers accept only one version; earlier output
follows [baseline compatibility](./mokly-baseline-compatibility.md).

The [complete format inventory](./mokly-format-versions.md) also defines
bootstrap, inspector, capability, cache and transport versions. Readers reject
unsupported versions before content or path interpretation.

## Contracts

- [Path identity in one generated tree](./mokly-path-output-integration.md) —
  approved combined layout, Markdown resource closure and baseline behavior.
- [Combined format versions](./mokly-format-versions.md) — the complete public
  and private version inventory, including manifest v9, catalogue v5 and review v6.
- [Accepted generation routes](./mokly-generation-routes.md) — immutable
  in-memory route snapshots, strict IPC and writer-only output locking.

- [Public file policy and closure](./mokly-public-closure.md) — approved shared
  classification, traversal, safe Serve reads and acceptance.
- [Shared Watch and output writers](./mokly-watch-writers.md) — approved input
  setup, cancellation, summaries and notice streams.
- [Comparison inventories and post-render edits](./mokly-comparison-inventory.md)
  — approved side-aware resource reads, baseline races and offset mapping.
- [Check, export and frame boundaries](./mokly-boundary-results.md) — implemented
  delivery parsing and export refusals; target Git-state and frame-identity rules.
- [Public API reports and unused members](./verification-api-members.md) —
  approved signature reports, release-note gate and member ratchet.

- [CI verification](./ci-verification.md) — implemented suite, shard, evidence,
  cache and aggregation contract.
  - [CI dependency cache and security](./ci-verification-security.md).
  - [Repository gate and length audits](./ci-verification-repository.md).
  - [Development hydration coverage](./ci-verification-hydration.md) — one
    route per entry shape and the generated resource audit.
- [Remote verification](./remote-verification.md) — implemented explicit and automatic execution.
  - [Testbox execution](./remote-verification-testbox.md) — workflow, commands, sync probe, suite wrapper, source-tree fingerprint, report download and aggregation.
- [CI workflow graph](./ci-workflow.md)
- [CI suite evidence](./ci-suite-evidence.md) — fixture cleanup, browser shard balance and acceptance measurement.
- [CI test timing](./ci-test-timing.md) — deterministic assertions, duration reporting and lint guard.
- [Repository verification ratchets](./verification-ratchets.md)
- [Catalogue upload v2](./mokly-upload.md) — public CLI, repository identity,
  upload manifest, output entry point and composite action boundary.
- [Catalogue upload exchange v1](./mokly-upload-exchange.md) — Plan, Blob and
  Complete requests, retries, expiry, and accounting.
- [Catalogue upload validation v2](./mokly-upload-validation.md) — rejection
  categories, limits, and independent receiver validation.
- [Root discovery and ownership](./mokly-root-discovery.md)
- [Package and authoring contract](./mokly-package.md)
- [CLI terminal output](./mokly-terminal-output.md) — plain compatibility,
  interactive progress, watched events, and shortcuts.
- [CLI terminal compatibility and errors](./mokly-terminal-errors.md) — exact
  plain output and rich error presentation.
- [Build warnings](./mokly-build-warnings.md) — implemented non-fatal compile
  diagnostics, command reporting, and `--strict` enforcement.
- [Packaged CLI guides](./mokly-guides.md) — versioned Markdown consumed by the
  cloud documentation site.
- [Configuration contract](./mokly-configuration.md) — catalogue paths and settings.
- [Generated output, Git state and asset closure](./mokly-generated-output.md)
  — implemented layout, manifest v9, tracked-state, closure and writer contracts.
- [Unified generated output and imported styles](./mokly-unified-output.md)
  — approved single-tree layout, reserved routes, reference policy, PostCSS and
  CSS delivery without output modes.
- [Generated manifest and baseline version gate](./mokly-generated-manifest.md)
  — approved v9 identity schema/inventory, earlier-version outcome and cache policy.
- [Portable viewer namespace and version gates](./mokly-viewer-namespace.md)
  — approved `mokly-viewer/` paths, version errors and upload compatibility.
  - [Entry discovery](./mokly-configuration-discovery.md).
  - [Imported CSS configuration](./mokly-configuration-imported-styles.md).
- [CI fixture preparation](./ci-fixture-preparation.md) — the implementation plan target.
- [Directory constants and import lint](./mokly-directory-lint.md)
  — approved independent literal guard, retained source-ordering rule and
  duplicate-import enforcement with folder coverage probes.
- [Historical catalogue discovery and addressing](./mokly-baseline-addressing.md)
  — approved moved-root v9 discovery and descriptors without older-format content readers.
- [Generated document delivery](./mokly-generated-delivery.md)
  — identity-derived HTML prefixes, catalogue-v5 policy and static/frame URL mapping.
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
  - [Generated rendering contract](./mokly-rendering-generated.md).
- [Build and Browse runtime](./mokly-runtime.md)
- [Navigation disclosure persistence](./mokly-disclosure-persistence.md) —
  storage, defaults, watched recovery, and in-place reconciliation.
- [Component instance identity](./mokly-instances.md) — existing key/boundary
  rules and approved resolution/source-location target.
- [Public catalogue read model](./mokly-catalogue.md) — path-keyed public
  inventory beside the private manifest, with its
  [fetch rules](./mokly-catalogue-fetch.md) and
  [tree and section order](./mokly-catalogue-tree.md).
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
  interface and cross-origin inspector protocol v2.
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
- [Changes and screen comparisons](./mokly-changes.md), with
  [comparison serving](./mokly-comparison-serving.md) for generation and
  serving rules.
  - [Changes serving and comparison](./mokly-changes-serving.md).
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
- [Per-commit baselines](./mokly-derived-baselines.md) — verified v9 Git blobs
  or rebuilt output, independent of head tracking.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive
    limits, command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Manifest schema](./mokly-component-manifest.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Component comparison schema](./mokly-component-review.md)
- [Component review validation and canonical output](./mokly-component-review-validation.md)
- [Component change attribution](./mokly-component-changes.md)
- [CSS change attribution](./mokly-css-attribution.md) — implemented
  rule-aware stylesheet evidence.
  - [CSS attribution membership](./mokly-css-attribution-membership.md).
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
- [Export ownership v3](./mokly-export-ownership.md) — public per-file digest
  inventory and compatibility fixtures for independent upload receivers.
- [Watched development](./mokly-watch.md)
  - [Watch runtime and recovery](./mokly-watch-runtime.md).
- [Catalogue navigation contract](./mokly-navigation.md), with
  [final logical link validation](./mokly-link-validation.md)
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

- [Catalogue serialization](./mokly-catalogue-serialization.md) — canonical bytes,
  snapshot identity and strict current-format readers.
- [Historical npm upgrade notes](./npm-release-history.md) — earlier release guidance.

- [Deterministic test repositories](./ci-test-repository-inputs.md) — fixture history and remote-state protection.

- [Frame link navigation](./mokly-frame-link-navigation.md) — shared fragment scope and transport boundaries.
