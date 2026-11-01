# Protocol

These documents are Mokly's specification. They define the intended behaviour
of the product: the Rust core, the render sidecar, the Browse shell, and the
release and verification tooling around them. A page that describes behaviour
which is not implemented yet starts with a status line.
Every other page describes implemented behaviour. The
[repository rules](../../AGENTS.md#repository-rules) hold the rule.

The [path contract](./mokly-paths.md) defines the path-based model: every entry
is identified by a path derived from its file, Markdown files are documents,
and moves are paired with their previous path.

## Graceful Handling

For duplicate CSS, configured-link placement or overlap, and stylesheet owners,
continue with safe, unambiguous output and warn when an authored input is
discarded. Confinement and source protection still apply. `build --strict` and
`publish --strict` fail before writes or uploads when a warning exists; Serve refuses
strict mode.

## Supported Formats

The [format inventory](./mokly-format-versions.md) lists the catalogue index,
entry detail, and upload versions, the versions of the in-memory review result
and change snapshot, and the rule for an unsupported version.

## Authoring

How a catalogue is written: paths and roots, entry modules, HTML screens and components, props and variants, pages, documents, configuration, links, and the guides.

- [Component Instance Identity](./mokly-instances.md)
- [Component Prop Schema](./mokly-component-props.md)
- [Component Stylesheets](./mokly-component-stylesheets.md)
- [Entry Modules](./mokly-entry-modules.md)
- [Entry Props And Variants](./mokly-entry-props.md)
- [Final Logical Link Validation](./mokly-link-validation.md)
- [Folders](./mokly-folders.md)
- [Front Matter YAML](./mokly-front-matter-yaml.md)
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
- [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md)
- [Imported Stylesheet CSS Modules](./mokly-imported-styles-modules.md)
- [Imported Stylesheet Delivery](./mokly-imported-styles.md)
- [Imported Stylesheet Diagnostics](./mokly-imported-styles-errors.md)
- [Imported Stylesheet PostCSS And Dependency Inventory](./mokly-imported-styles-postcss.md)
- [Path-Derived Artifact Paths](./mokly-artifact-paths.md)
- [Public File Policy And Referenced Closure](./mokly-public-closure.md)
- [Render Sidecar](./mokly-sidecar.md)
- [Sidecar Definition Transport](./mokly-sidecar-definitions.md)
- [Sidecar Module Sources](./mokly-sidecar-modules.md)
- [Sidecar Render Records](./mokly-sidecar-render-records.md)
- [Rendering And Document Assembly](./mokly-rendering.md)

## Comparison And Changes

How two commits are compared: tree comparison, CSS attribution, component evidence, moves, removed entries, and the comparison routes.

- [Base Source And Dependency Preparation](./mokly-base-preparation.md)
- [Base Dependency Installation](./mokly-base-dependencies.md)
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
- [CSS Rule Membership And Identity](./mokly-css-attribution-rules.md)
- [Moves](./mokly-moves.md)
- [Removed Content Previews](./mokly-removed-previews.md)
- [Selected live comparisons](./mokly-selected-comparisons.md)
- [Tree Comparison And Changes](./mokly-comparison.md)
- [Comparison Tree Model](./mokly-comparison-tree.md)
- [Comparison Package Selection](./mokly-comparison-packages.md)
- [Git Command Runtime](./mokly-git.md)

## Read Model And Delivery

What the shell reads: the catalogue index and entry detail, their routes, identity and versions, live capabilities, and the viewer namespace.

- [Catalogue Projection And Delivery](./mokly-catalogue-delivery.md)
- [Catalogue Serialization, Identity And Versions](./mokly-catalogue-serialization.md)
- [Catalogue Tree](./mokly-catalogue-tree.md)
- [Combined Path And Output Format Versions](./mokly-format-versions.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Portable Viewer Namespace And Version Gates](./mokly-viewer-namespace.md)
- [Public Catalogue Read Model](./mokly-catalogue.md)
- [Shell Delivery And Read Model Routes](./mokly-shell-delivery.md)
- [Shell Fetch And Fences](./mokly-shell-fences.md)
- [Variant Navigation And Changes](./mokly-variant-navigation.md)

## Serve, Watch, And The CLI

The development server, on-demand rendering, the watcher, live controls, terminal output, and diagnostics.

- [CLI Terminal Compatibility And Errors](./mokly-terminal-errors.md)
- [CLI Terminal Output](./mokly-terminal-output.md)
- [CLI Comparison Steps](./mokly-terminal-steps.md)
- [CLI Help And Version Bytes](./mokly-terminal-help.md)
- [Component Controls](./mokly-component-controls.md)
- [Mokly Build And Browse Runtime](./mokly-runtime.md)
- [On-demand Serve](./mokly-on-demand.md)
- [Startup Diagnostics And Scale Fixtures](./mokly-timings.md)
- [Watch Runtime And Recovery](./mokly-watch-runtime.md)
- [Watched Catalogue Development](./mokly-watch.md)

## Static Build And Publish

The static output of `build`, its safety and ownership rules, publication, and the upload exchange.

- [Catalogue Upload Exchange v1](./mokly-upload-exchange.md)
- [Catalogue Upload v3](./mokly-upload.md)
- [Catalogue Upload Validation v3](./mokly-upload-validation.md)
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
- [Embeddable Viewer API](./mokly-viewer-api.md)
- [Frame Link Navigation](./mokly-frame-link-navigation.md)
- [Inspector Handshake And Wire Protocol](./mokly-inspector-wire.md)
- [Logical Link Composition](./mokly-logical-links.md)
- [Mokly Catalogue Navigation Contract](./mokly-navigation.md)
- [Mokly Shell Brand](./mokly-shell-brand.md)
- [Navigation Disclosure Persistence](./mokly-disclosure-persistence.md)
- [Published Inspector](./mokly-published-inspector.md)
- [Shared UI Package](./mokly-ui-package.md)
- [Shell Destination Queries](./mokly-shell-destinations.md)
- [Shell Device Chrome And Preview Scheme](./mokly-shell-device-chrome.md)
- [Viewer Appearance](./mokly-viewer-appearance.md)
- [Viewer Frame Adapter](./mokly-frame-adapter.md)
- [Viewer Markers And Multi-Instance Highlights](./mokly-viewer-markers.md)
- [Viewer Selection, Events And Shell State](./mokly-viewer-selection.md)
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
- [Design Mockup Navigation Links](./mokly-design-links-navigation.md)
- [Design Mockup Scheme, Comparison, And Tag Links](./mokly-design-links-comparisons.md)
- [Mokly Design Component Library Inventory](./mokly-design-component-library.md)
- [Mokly Design Mockup Links](./mokly-design-links.md)
- [Mokly Shell Design Contract](./mokly-shell-design.md)
- [Registered Components In Mokly's Design Catalogue](./mokly-design-components.md)
- [Shell Design Inventory](./mokly-shell-design-inventory.md)
- [Shell Navigation Column Design](./mokly-shell-design-navigation.md)
- [Viewer Appearance Mockups](./mokly-viewer-appearance-mockups.md)

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
- [Developer Browser Commands](./developer-browser-commands.md)
- [Packed Consumer Smoke](./packed-consumer-smoke.md)
- [GitHub Publishing Protections](./npm-github-protections.md)
- [Mokly CI And Npm Release Contract](./npm-release.md)
- [npm Release Management](./npm-release-management.md)
- [Npm Release Operations](./npm-release-operations.md)
- [Npm Release Verification Evidence](./npm-release-evidence.md)
- [One-Time Mokly Registry Bootstrap](./npm-bootstrap.md)
- [Remote Verification](./remote-verification.md)
- [Remote Verification: Base Commit Sync](./remote-verification-base.md)
- [Remote Verification: Cleanup And Interrupts](./remote-verification-cleanup.md)
- [Remote Verification: Testbox Execution](./remote-verification-testbox.md)
- [Repository Gate And Length Audits](./ci-verification-repository.md)
- [Repository Preview Deployments](./npm-preview-deployments.md)
- [Repository Verification Ratchets](./verification-ratchets.md)
- [Selected Developer Test Results](./developer-test-results.md)
