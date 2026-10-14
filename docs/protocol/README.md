# Protocol

These documents are Mokly's specification. They define the intended behaviour
of the product: the Rust core, the render sidecar, the Browse shell, and the
release and verification tooling around them. A page that describes behaviour
which is not implemented yet starts with one line, `Status: In progress under
the Rust rebuild plan`; every other page describes implemented behaviour. The
[documentation policy](./documentation-policy.md) holds the rule.

The [path contract](./mokly-paths.md) defines the path-based model: every entry
is identified by a path derived from its file, Markdown files are documents,
and moves are paired with their previous path.

## Graceful Handling

For duplicate CSS, configured-link placement or overlap, and stylesheet owners,
continue with safe, unambiguous output and warn when an authored input is
discarded. Confinement and source protection still apply. `build --strict` and
`publish` fail before writes or uploads when a warning exists; Serve refuses
strict mode.

## Supported Formats

The [format inventory](./mokly-format-versions.md) lists the catalogue index,
entry detail, review result, and change snapshot versions. A reader rejects an
unsupported number before it interprets content.

## Authoring

How a catalogue is written: paths and roots, entry modules, HTML screens and components, props and variants, pages, documents, configuration, links, and the guides.

- [Component Instance Identity](./mokly-instances.md)
- [Component Prop Schema](./mokly-component-props.md)
- [Component Stylesheets](./mokly-component-stylesheets.md)
- [Configuration Discovery](./mokly-configuration-discovery.md)
- [Entry Modules](./mokly-entry-modules.md)
- [Entry Props And Variants](./mokly-entry-props.md)
- [Final Logical Link Validation](./mokly-link-validation.md)
- [Folders](./mokly-folders.md)
- [HTML Components](./mokly-html-components.md)
- [HTML Screens, Pages, And Use Cases](./mokly-html-screens.md)
- [Imported CSS Configuration](./mokly-configuration-imported-styles.md)
- [Markdown Documents](./mokly-documents.md)
- [Mokly Configuration Contract](./mokly-configuration.md)
- [Mokly Guides Contract](./mokly-guides.md)
- [Mokly Package And Authoring Contract](./mokly-package.md)
- [Mokly Public Authoring Contract](./mokly-authoring.md)
- [Pages In The Catalogue](./mokly-pages.md)
- [Paths, Roots, And Identity](./mokly-paths.md)
- [Registered Components](./mokly-components.md)
- [Root Discovery And Source Membership](./mokly-root-discovery.md)
- [Styled Catalogue Link Controls](./mokly-link-controls.md)
- [Variants](./mokly-variants.md)

## Rendering

How the Rust core and the sidecar turn sources into documents: the sidecar protocol, document assembly and safety, stylesheets, the asset closure, source protection, warnings, and artifact paths.

- [Build Warnings](./mokly-build-warnings.md)
- [Catalogue Source Protection](./mokly-source-protection.md)
- [Document Rendering Safety](./mokly-document-safety.md)
- [Identity-Derived Document Delivery](./mokly-generated-delivery.md)
- [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md)
- [Imported Stylesheet CSS Modules](./mokly-imported-styles-modules.md)
- [Imported Stylesheet Delivery](./mokly-imported-styles.md)
- [Imported Stylesheet Diagnostics](./mokly-imported-styles-errors.md)
- [Imported Stylesheet PostCSS And Dependency Inventory](./mokly-imported-styles-postcss.md)
- [Path-Derived Artifact Paths](./mokly-artifact-paths.md)
- [Public File Policy And Referenced Closure](./mokly-public-closure.md)
- [Render Sidecar](./mokly-sidecar.md)
- [Rendering And Document Assembly](./mokly-rendering.md)

## Comparison And Changes

How two commits are compared: tree comparison, CSS attribution, component evidence, moves, removed entries, and the comparison routes.

- [Branch-Point Entry Lookup](./mokly-branch-point-lookup.md)
- [Catalogue Change Metadata And Removed Pages](./mokly-catalogue-changes.md)
- [Catalogue Entry Records](./mokly-component-manifest.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Changes Serving And Comparison](./mokly-changes-serving.md)
- [Comparison Generation And Serving](./mokly-comparison-serving.md)
- [Comparison Region Pairing](./mokly-comparison-region-pairing.md)
- [Component Change Attribution](./mokly-component-changes.md)
- [Component Comparison Records](./mokly-component-comparison-records.md)
- [Component Comparison Schema](./mokly-component-review.md)
- [Component Review Validation](./mokly-component-review-validation.md)
- [Component Usage Records](./mokly-component-usage-records.md)
- [CSS Attribution Membership](./mokly-css-attribution-membership.md)
- [CSS Change Attribution](./mokly-css-attribution.md)
- [CSS Document Matching](./mokly-css-document-matching.md)
- [CSS Rule Membership And Identity](./mokly-css-attribution-rules.md)
- [Moves](./mokly-moves.md)
- [Publication Changes And Acceptance](./mokly-publication-changes.md)
- [Removed Content Previews](./mokly-removed-previews.md)
- [Removed Preview Acceptance](./mokly-removed-preview-acceptance.md)
- [Removed Preview Frames And Lifecycle](./mokly-removed-preview-frames.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Tree Comparison And Changes](./mokly-comparison.md)

## Read Model And Delivery

What the shell reads: the catalogue index and entry detail, their routes, identity and versions, live capabilities, and the viewer namespace.

- [Catalogue Projection And Delivery](./mokly-catalogue-delivery.md)
- [Catalogue Read Model Fetch Rules](./mokly-catalogue-fetch.md)
- [Catalogue Serialization, Identity And Versions](./mokly-catalogue-serialization.md)
- [Catalogue Tree](./mokly-catalogue-tree.md)
- [Combined Path And Output Format Versions](./mokly-format-versions.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Live Viewer Capabilities](./mokly-live-capabilities.md)
- [Portable Viewer Namespace And Version Gates](./mokly-viewer-namespace.md)
- [Public Catalogue Read Model](./mokly-catalogue.md)
- [Shell Delivery And Read Model Routes](./mokly-shell-delivery.md)
- [Variant Navigation And Changes](./mokly-variant-navigation.md)

## Serve, Watch, And The CLI

The development server, on-demand rendering, the watcher, live controls, terminal output, and diagnostics.

- [CLI Terminal Compatibility And Errors](./mokly-terminal-errors.md)
- [CLI Terminal Output](./mokly-terminal-output.md)
- [Component Controls](./mokly-component-controls.md)
- [Mokly Build And Browse Runtime](./mokly-runtime.md)
- [On-demand Serve](./mokly-on-demand.md)
- [Startup Diagnostics And Scale Fixtures](./mokly-timings.md)
- [Watch Runtime And Recovery](./mokly-watch-runtime.md)
- [Watched Catalogue Development](./mokly-watch.md)

## Static Build And Publish

The static output of `build`, its safety and ownership rules, publication, and the upload exchange.

- [Catalogue Upload Exchange v1](./mokly-upload-exchange.md)
- [Catalogue Upload v2](./mokly-upload.md)
- [Catalogue Upload Validation v2](./mokly-upload-validation.md)
- [Export Ownership v3](./mokly-export-ownership.md)
- [Optional Changes In Published Catalogues](./mokly-publication.md)
- [Static Build](./mokly-export.md)
- [Static Build Browser And Identity](./mokly-export-browser.md)
- [Static Build Public Files And Package Boundary](./mokly-export-public-files.md)
- [Static Build Recovery](./mokly-export-recovery.md)
- [Static Build Safety And Public Files](./mokly-export-safety.md)
- [Static Delivery](./mokly-export-delivery.md)

## Viewer

The Browse shell: the embeddable viewer, appearance, navigation, frames, inspection, comparison panes, and evidence presentation.

- [Changes Screen Controls](./mokly-changes-controls.md)
- [Comparison Pane Presentation](./mokly-comparison-panes.md)
- [Comparison Scroll Together](./mokly-comparison-scroll-together.md)
- [Comparison Scrolling](./mokly-comparison-scrolling.md)
- [Component Pages And Screen Inspection](./mokly-component-explorer.md)
- [CSS Evidence In The Shell](./mokly-css-evidence-shell.md)
- [CSS Evidence Presentation](./mokly-css-evidence-presentation.md)
- [Embeddable Mokly Viewer](./mokly-viewer.md)
- [Frame Link Navigation](./mokly-frame-link-navigation.md)
- [Mokly Catalogue Navigation Contract](./mokly-navigation.md)
- [Mokly Shell Brand](./mokly-shell-brand.md)
- [Navigation Disclosure Persistence](./mokly-disclosure-persistence.md)
- [Published Inspector And Overlay](./mokly-published-inspector.md)
- [Shell Destination Queries](./mokly-shell-destinations.md)
- [Shell Device Chrome And Preview Scheme](./mokly-shell-device-chrome.md)
- [Viewer Appearance](./mokly-viewer-appearance.md)
- [Viewer Frame Adapter](./mokly-frame-adapter.md)
- [Viewer Markers And Multi-Instance Highlights](./mokly-viewer-markers.md)
- [Viewer Semantic Palette](./mokly-viewer-palette.md)

## Design Mockups

The design catalogue that depicts the shell, its inventories, and the shared design components.

- [Comparison Pane Design References](./mokly-comparison-pane-designs.md)
- [Component Controls Design](./mokly-component-controls-design.md)
- [Component Design Inventory](./mokly-component-design-inventory.md)
- [Component Explorer Design](./mokly-component-design.md)
- [Component Inspector Design](./mokly-component-inspector-design.md)
- [Component Workspace Design](./mokly-component-workspace-design.md)
- [Depicted Design Catalogue](./mokly-shell-design-catalogue.md)
- [Design Component Attribution](./mokly-design-component-attribution.md)
- [Mokly Design Component Library Inventory](./mokly-design-component-library.md)
- [Mokly Design Mockup Links](./mokly-design-links.md)
- [Mokly Shell Design Contract](./mokly-shell-design.md)
- [Registered Components In Mokly's Design Catalogue](./mokly-design-components.md)
- [Shell Design Inventory](./mokly-shell-design-inventory.md)

## CI, Verification, And Release

The repository gate, remote verification, dependency audits, test rules, and the npm release contracts.

- [CI Suite Evidence](./ci-suite-evidence.md)
- [CI Test Timing](./ci-test-timing.md)
- [CI Verification](./ci-verification.md)
- [CI Verification: Dependency Cache And Security](./ci-verification-security.md)
- [CI Workflow Graph](./ci-workflow.md)
- [Dependency Audit Baseline](./dependency-audit-baseline.md)
- [Dependency Security](./dependency-security.md)
- [Dependency Update Pull Request](./dependency-audit-update-pr.md)
- [Deterministic Test Repository Inputs](./ci-test-repository-inputs.md)
- [Developer Test Commands](./developer-test-commands.md)
- [GitHub Publishing Protections](./npm-github-protections.md)
- [Historical npm Upgrade Notes](./npm-release-history.md)
- [Mokly CI And Npm Release Contract](./npm-release.md)
- [npm Format And Tooling Release Notes](./npm-release-notes-formats.md)
- [npm Release Management](./npm-release-management.md)
- [npm Release Notes](./npm-release-notes.md)
- [Npm Release Operations](./npm-release-operations.md)
- [Npm Release Verification Evidence](./npm-release-evidence.md)
- [One-Time Mokly Registry Bootstrap](./npm-bootstrap.md)
- [Public API Reports And Unused Members](./verification-api-members.md)
- [Remote Verification](./remote-verification.md)
- [Remote Verification: Base Commit Sync](./remote-verification-base.md)
- [Remote Verification: Cleanup And Interrupts](./remote-verification-cleanup.md)
- [Remote Verification: Testbox Execution](./remote-verification-testbox.md)
- [Repository Gate And Length Audits](./ci-verification-repository.md)
- [Repository Preview Deployments](./npm-preview-deployments.md)
- [Repository Verification Ratchets](./verification-ratchets.md)
- [Selected Developer Test Results](./developer-test-results.md)
- [Verification And Release Protocols](./verification-protocol-index.md)

## Process

The documentation rule and the rebuild procedures.

- [Documentation Policy](./documentation-policy.md)
- [Rust Rebuild Procedures](./rust-rebuild-procedures.md)
