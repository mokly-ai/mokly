# Protocol

These documents define Mokly's implementation contract. They describe
implemented pre-release behavior unless a document's Delivery Status explicitly
labels an approved target that is still tracked by an active plan. Package,
authoring, static build/check, responsive Browse, watched development, on-demand comparisons,
packed consumer verification, CI, and npm release automation are implemented.
The first public release remains an external delivery step.

## Supported Formats

The following table describes the current branch before the planned main merge.

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 6                  | 2                 |
| With registered components    | 6                  | 3                 |

All current catalogues emit manifest v6 with explicit pages, the complete
source inventory, referenced asset closure, Git blob inventory and declared
dependencies. Component catalogues also include
saved variants and complete per-view usage. Comparisons use v3 whenever either
side contains registered components, including when the last component is removed;
otherwise they use v2. Pages participate in Browse Changes without visual comparisons.

The current primary file requires v6. Git baseline readers accept v5, v3 and both
historical v4 formats: pages with `sourceFiles`, or components with `legacyPages`.
These envelopes are disjoint; combining them is invalid. Explicit
`compatibility.readManifestV2` permits the legacy v2-format fallback only
when the historical primary file is absent, never when it is invalid.

Milestone 9 of Generated Output Simplification defines an approved merge target,
not another implemented format: private manifest v8, public catalogue v4,
delivery v4, a versioned shell bootstrap, ownership v3 and upload v2. The
contracts below define the implementation sequence. Correction 3 option A
allows only v8 baseline content: every earlier base gets `main`'s typed
incompatible-earlier outcome. Public catalogue v4 has no older-version reader
or optional-prefix legacy fallback. These targets supersede the pre-merge
compatibility policy above when Milestones 11–12 land.
The current catalogue, adapter, export and upload implementation pages still
describe pre-merge wire formats; [generated delivery](./mokly-generated-delivery.md)
owns the merged prefix and viewer-version policy to apply during reconciliation.

## Contracts

- [CI verification](./ci-verification.md) — implemented suite, shard, evidence,
  cache and aggregation contract; hosted acceptance measurements remain tracked
  by the active CI performance plan.
- [CI fixture preparation and lifetime](./ci-fixture-preparation.md) — existing
  cleanup/measurement rules and approved shared example-baseline preparation,
  retained cold regressions and unchanged 600-second fixture limit.
- [Catalogue upload v1](./mokly-upload.md) — public CLI and hosted/self-hosted receiver boundary.
- [Package and authoring contract](./mokly-package.md)
- [CLI terminal output](./mokly-terminal-output.md) — plain compatibility,
  interactive progress, errors, watched events, and shortcuts.
- [Packaged CLI guides](./mokly-guides.md) — versioned Markdown consumed by the
  cloud documentation site.
- [Configuration contract](./mokly-configuration.md) — catalogue paths and settings.
- [Generated output, Git state and asset closure](./mokly-generated-output.md)
  — implemented layout, manifest v6, tracked-state, closure and writer contracts.
- [Unified generated output and imported styles](./mokly-unified-output.md)
  — approved single-tree layout, reserved routes, reference policy, PostCSS and
  CSS delivery without output modes.
- [Generated manifest and baseline version gate](./mokly-generated-manifest.md)
  — approved v8 identity schema/inventory, earlier-version outcome and cache policy.
- [Portable viewer namespace and version gates](./mokly-viewer-namespace.md)
  — approved `mokly-viewer/` paths, version errors and upload compatibility.
- [Directory constants and import lint](./mokly-directory-lint.md)
  — approved independent literal guard, retained source-ordering rule and
  duplicate-import enforcement with folder coverage probes.
- [Historical catalogue discovery and addressing](./mokly-baseline-addressing.md)
  — approved moved-root v8 discovery and descriptors without legacy content readers.
- [Generated document delivery](./mokly-generated-delivery.md)
  — identity-derived HTML prefixes, catalogue-v4 policy and static/frame URL mapping.
- [Public authoring API](./mokly-authoring.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Component instance identity](./mokly-instances.md) — existing key/boundary
  rules and approved resolution/source-location target.
- [Public catalogue read model](./mokly-catalogue.md) — implemented:
  public inventory v1 beside the private manifest.
- [Embeddable viewer](./mokly-viewer.md) — approved `@mokly/viewer` API and
  unchanged local shell extraction.
- [Live viewer capabilities](./mokly-live-capabilities.md) — private Serve
  evidence, updates, recovery, previews and on-demand rendering for React.
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md) —
  host-owned anchored content and exact atomic highlight behavior.
- [Viewer frame adapter](./mokly-frame-adapter.md) — approved same-origin
  interface and cross-origin inspector protocol v1.
- [On-demand Serve](./mokly-on-demand.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Startup diagnostics and scale fixtures](./mokly-timings.md)
- [Pages in the catalogue](./mokly-pages.md)
- [Screen variants](./mokly-screen-variants.md) — implemented: variant
  screens grouped under their parent screen with their own ids and routes.
- [Source protection](./mokly-source-protection.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Breaking page migration](./mokly-page-migration.md)
- [Optional changes in publication](./mokly-publication.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Removed content previews](./mokly-removed-previews.md) — removed screens
  and pages show their pinned baseline version.
- [Per-commit baseline selection](./mokly-derived-baselines.md) — Git blobs
  when complete, otherwise a trusted historical rebuild.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive limits,
    command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Component manifest fields](./mokly-component-manifest.md) — retained in v6.
- [Component comparison v3 schema](./mokly-component-review.md)
- [Component change attribution](./mokly-component-changes.md)
- [CSS change attribution](./mokly-css-attribution.md) — approved
  target: rule-aware stylesheet evidence.
- [CSS evidence in the shell](./mokly-css-evidence-shell.md) — inspector and
  comparison-stage presentation of stylesheet evidence.
- [Component pages and screen inspection](./mokly-component-explorer.md)
- [Component explorer design catalogue](./mokly-component-design.md)
- [Component icon inspector design](./mokly-component-inspector-design.md)
- [Component controls design catalogue](./mokly-component-controls-design.md)
- [Component workspace design](./mokly-component-workspace-design.md) (view controls, resizing, and comparison eligibility)
- [Component controls](./mokly-component-controls.md)
- [Consumer static export](./mokly-export.md) — consumer CLI and
  transactional artifact-generation contract.
- [Static export delivery](./mokly-export-delivery.md) — portable
  hosting, navigation, and comparison behavior.
- [Export recovery](./mokly-export-recovery.md) — backup ownership,
  concurrent destination changes, bounded cleanup, and failure reporting.
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
  - [Release verification evidence](./npm-release-evidence.md)
  - [One-time registry bootstrap](./npm-bootstrap.md)
  - [GitHub publishing protections](./npm-github-protections.md)
- [Dependency security](./dependency-security.md) — advisory gates, targeted
  updates, temporary overrides, and packed-consumer audit coverage.
