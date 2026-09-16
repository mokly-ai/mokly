# Protocol

These documents define Mokly's implementation contract. They describe
implemented pre-release behavior unless a document's Delivery Status explicitly
labels an approved target that is still tracked by an active plan. Package,
authoring, static build/check, responsive Browse, watched development, on-demand comparisons,
packed consumer verification, CI, and npm release automation are implemented.
The first public release and downstream Accounting cutover remain external
delivery steps.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 5                  | 2                 |
| With registered components    | 5                  | 3                 |

All current catalogues emit manifest v5 with explicit pages, the complete
source inventory and declared dependencies. Component catalogues also include
saved variants and complete per-view usage. Comparisons use v3 whenever either
side contains registered components, including when the last component is removed;
otherwise they use v2. Pages participate in Browse Changes without visual comparisons.

The current primary file requires v5. Git baseline readers accept v3 and both
historical v4 formats: pages with `sourceFiles`, or components with `legacyPages`.
These envelopes are disjoint; combining them is invalid. Explicit
`compatibility.readManifestV2` permits the old Accounting-format fallback only
when the historical primary file is absent, never when it is invalid.

## Contracts

- [Catalogue upload v1](./mokly-upload.md) — public CLI and hosted/self-hosted receiver boundary.
- [Package and authoring contract](./mokly-package.md)
- [Configuration contract](./mokly-configuration.md) — includes public-exclusion validation and defaults.
- [Public authoring API](./mokly-authoring.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [On-demand Serve](./mokly-on-demand.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Startup diagnostics and scale fixtures](./mokly-timings.md)
- [Pages in the catalogue](./mokly-pages.md)
- [Source protection](./mokly-source-protection.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Breaking page migration](./mokly-page-migration.md)
- [Optional changes in publication](./mokly-publication.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Derived baselines](./mokly-derived-baselines.md) — approved target:
  uncommitted generated output with per-commit rebuilt baselines.
  - [Baseline storage and execution](./mokly-baseline-storage.md) — archive limits,
    command environments, locking and crash cleanup.
- [Registered components](./mokly-components.md)
- [Component runtime prop schema](./mokly-component-props.md)
- [Current manifest v5 schema](./mokly-component-manifest.md)
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
  - [One-time registry bootstrap](./npm-bootstrap.md)
  - [GitHub publishing protections](./npm-github-protections.md)
- [Dependency security](./dependency-security.md) — advisory gates, targeted
  updates, temporary overrides, and packed-consumer audit coverage.
