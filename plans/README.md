# Plans

## Active

- [React Browse Shell](./react-browse-shell.md)
- [CI Performance](./ci-performance.md) — parallel verification, complete test
  sharding, reusable preparation and measured CI timing improvements.
- [CLI Terminal Experience](./cli-terminal-experience.md)
- [Package Documentation](./package-documentation.md) — supersedes the
  unmerged public-site plan and pull request #79 by shipping versioned Markdown
  guides in `@mokly/mokly` for the cloud repository to render.
- [Viewer Comment Anchoring](./viewer-comment-anchoring.md)
- [Mokabook Dependency Patch Upstreaming](./mokabook-dependency-patch-upstreaming.md)
- [Publish Catalogue](./publish-catalogue.md)
- [App-Independent Mokabook Npm Library](./app-independent-mokabook-library.md)
- [Browse Shell Design Parity](./browse-shell-design-parity.md)
- [Unchanged View Fast Path](./unchanged-view-fast-path.md) — post-review
  correctness fixes are active until the PR merges.
- [Authenticated Frame Document Handoff](./authenticated-frame-document-handoff.md)
  — closes the React Browse Shell Milestone 13/14 review finding by attaching
  the same-origin mount-time navigation receiver only to a previously
  authenticated document.
- [Viewer-Owned Historical Previews](./viewer-owned-historical-previews.md)
  — closes the removed content previews High finding by presenting every
  historical document through a viewer-owned same-origin document so the
  read-only guard applies in cross-origin embedded viewers too.
- [Evidence-First Release Publish](./evidence-first-release-publish.md)
  — publish consumes the release PR's validated CI evidence for the same
  tree instead of re-running the complete gate, with the complete gate as
  the fail-closed fallback.

## Completed

- [Removed Content Previews](./removed-content-previews.md) — delivered and
  verified; Serve, exports, repository previews, and embedded viewers render
  pinned previous versions for removed documents and screens. Its High/P1
  cross-origin read-only finding is addressed by
  [Viewer-Owned Historical Previews](./viewer-owned-historical-previews.md).
- [Mokly Viewer Library](./mokly-viewer-library.md) — implementation and release
  PRs merged; viewer 0.1.0 and CLI 0.10.0 are published. One P2 review finding
  and the remaining published-package smoke are recorded for follow-up.
- [CSS Change Attribution](./css-change-attribution.md) — delivered, two
  rounds of review fixes applied, and reviewed three times; nine follow-up
  findings from the third review await the user's decision.
- [Review Fix Follow-ups](./review-fix-followups.md) — delivered and
  verified; review findings are recorded for the user's decision.
- [Derived Baseline Review Fixes](./derived-baseline-review-fixes.md) —
  delivered and verified; review findings are recorded for the user's decision.
- [Derived Baselines](./derived-baselines.md) — delivered and verified;
  review findings are recorded for the user's decision.
- [Mokly Package Migration](./mokly-package-migration.md) — repository fixes
  delivered and reviewed; authenticated main-only GitHub publishing protections
  are configured.
- [Optional Published Changes](./optional-published-changes.md)
- [Unified Catalogue Pages](./unified-catalogue-pages.md)
- [Reuse Registered Components In Mokabook's Design Catalogue](./mokabook-design-components.md)
  — delivered and verified; review follow-ups are recorded for the user's decision.
- [Component Explorer](./component-explorer.md) — delivered and verified;
  review follow-ups are recorded for the user's decision.
- [Consumer Static Export](./consumer-static-export.md)
- [Mokabook Design MockLinks](./mokabook-design-mocklinks.md)
- [MockLink Child Controls](./mocklink-child-controls.md)
- [Hierarchy-Inferred Breadcrumbs](./hierarchy-inferred-breadcrumbs.md)
- [In-Frame Catalogue Link Navigation](./in-frame-catalogue-link-navigation.md)
- [Native Color Scheme (Dark Mode) Support](./native-color-scheme-support.md)
- [Tag Filtering](./tag-filtering.md)
