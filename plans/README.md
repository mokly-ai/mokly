# Plans

## Active

- [Imported CSS Delivery](./imported-css-delivery.md) — shipped implementation
  and authorized final-review fixes complete; finding 3 was resolved by the
  separate `922c1ec` merge. Milestone 12 finding 1 was resolved in `d474975`;
  authorized findings from the
  [review record](../docs/reviews/imported-css-delivery.md) and
  [Milestone 14 review](../docs/reviews/imported-css-delivery-milestone-14.md)
  are resolved in Milestones 15–16 (`7b454b0`, `0ce4f20`). Unselected
  findings remain open. Milestone 18 (`3aa7d67`) resolves finding 2 from the
  [Milestone 17 review](../docs/reviews/imported-css-delivery-milestone-17.md)
  and supersedes findings 3, 8 and 9; its other findings remain open, as do
  the [Milestone 19 review](../docs/reviews/imported-css-delivery-milestone-19.md).
  Milestone 20 (`9bab3d7`) resolves finding 1 and partly mitigates finding 2 without
  changing other open findings. Findings in the
  [Milestone 21 review](../docs/reviews/imported-css-delivery-milestone-21.md)
  retain their individual resolution statuses.
  Milestone 22 (`8a47cc5`) accepts only the approved selector-list part of finding 3;
  its other parts remain open, as do findings in the
  [Milestone 23 review](../docs/reviews/imported-css-delivery-milestone-23.md).
  Milestone 24 (`7ba5628`) resolves the approved findings there; other findings
  remain open. Milestone 26 (`266164b`) resolves the approved findings in the
  [Milestone 25 review](../docs/reviews/imported-css-delivery-milestone-25.md).
  Milestone 28 (`c482bd0`) resolves the approved findings in the
  [Milestone 27 review](../docs/reviews/imported-css-delivery-milestone-27.md);
  other open findings remain unchanged. Milestone 30 (`5ae34be`) resolves the
  approved findings in the
  [Milestone 29 review](../docs/reviews/imported-css-delivery-milestone-29.md).
  Milestone 32 (`6a02190`) resolves only finding 1 in the
  [Milestone 31 review](../docs/reviews/imported-css-delivery-milestone-31.md);
  findings 2–4 remain open. Milestone 34 (`583af0a9`) resolves only finding 2 in the
  [Milestone 33 review](../docs/reviews/imported-css-delivery-milestone-33.md);
  findings 1 and 3 remain open, as do findings in the
  [Milestone 35 review](../docs/reviews/imported-css-delivery-milestone-35.md).
  Milestone 36 (`d72abaeb`) merged `origin/main` at `0c8245f8` with imported
  CSS, the v7 manifest, v3 read model, aligned comparison panes and delta
  publishing. The full gate passes and PR #125 is open. Findings
  in the [Milestone 37 review](../docs/reviews/imported-css-delivery-milestone-37.md)
  were reconciled in Milestone 38 (`c260b5b2`). Milestone 39 merged main's
  0.13.0 release (`3a2d90a8`) and passed the complete gate without removing
  main content. Findings in the
  [Milestone 40 review](../docs/reviews/imported-css-delivery-milestone-40.md)
  were addressed selectively: Milestone 41 (`7f64f8b0`) replaces the custom
  merge check for findings 1, 2, 4 and 11. Milestone 42 (`beab8560`) merges
  main's release-runner fix at `b4a02a30`. Milestone 44 (`8729ec16`) addresses the selected
  findings in the
  [Milestone 43 review](../docs/reviews/imported-css-delivery-milestone-43.md).
  Other findings remain outside this work. Findings in the
  [Milestone 45 review](../docs/reviews/imported-css-delivery-milestone-45.md)
  remain open for the user's decision. Milestone 46 addresses only the imported-CSS
  watcher-test flakiness recorded as Milestone 40 finding 12 (`77a1f493`),
  with an event-driven resource wait and a server-level content-order
  regression. Findings in the
  [Milestone 47 review](../docs/reviews/imported-css-delivery-milestone-47.md)
  remain open for the user's decision, as do other review findings.
  Move this plan to Completed when its
  implementation PR merges.
- [Delta Publishing](./delta-publishing.md) — replace the single-archive
  `mokly publish` upload with the content-addressed plan, blob and complete
  exchange, the schema 2 export ownership marker, v2 fixtures and guides for
  the next minor release. Implemented, verified, pushed and reviewed; the
  approved [review findings](../docs/reviews/delta-publishing.md) were fixed
  in Milestones 7–13, second-review findings 1 and 2 in Milestones 14–17 and
  the third-review findings in Milestones 18–22 and the fourth-review findings
  in Milestones 23–27, and the remote-state cleanup script was removed in
  Milestones 28–29, and the remote-branch lint was replaced by a workflow
  guard in Milestones 30–31, and the guard's scanner moved into a test helper
  in Milestones 32–33, and the browser shard that exceeded CI's job timeout was
  rebalanced in Milestones 34–39, and main's navigation paths and derived
  routes were merged in Milestones 40–41. The remaining open review
  findings await the user's decision. The plan stays Active until its pull
  request merges.
- [Path-Based Navigation Hierarchy](./nav-path-hierarchy.md) — replace
  collection entities and `childIds` with a Storybook-style `navPath` on
  every leaf, derived from nested `folder` titles; manifest v6 and read
  model v2. Milestones 1–12 are implemented, verified, pushed, and reviewed;
  findings 1–16 are fixed, findings 17–21 await the user's decision, and the
  plan stays Active until its PR merges.
- [Path-Only Evidence Stays Out Of Changes](./changes-path-only-evidence.md)
  — a changed file matched only by a shared-impact glob or a declared
  dependency directory becomes comparison evidence instead of listing every
  matching entry in Changes; owned paths and exact declared files keep their
  reasons. Milestones 1–12 are complete on the navigation path plan's branch
  and findings 3–8 are fixed; finding 2 moves to
  [Configurable Changes Listing](./configurable-changes-listing.md), findings
  9–11 await the user's decision, and the plan stays Active until PR #118
  merges.
- [Configurable Changes Listing](./configurable-changes-listing.md) — settings
  under `review.changes` decide which invisible change kinds (component data,
  component structure, declared files, shared files) list an entry in Changes;
  all default to not listed, metadata stays listed, and every reason is still
  recorded as evidence. Planned for a new PR after PR #118 merges; the
  settings UI comes later.
- [Comparison Pane Scroll Alignment](./comparison-pane-scroll-alignment.md)
  — Overlay and Difference drift apart when scrolled because each snapshot
  scrolls inside its own opaque frame; comparison panes become viewer-owned,
  device-sized presentations driven by one shared chrome viewport
  (Milestones 1 to 4, delivered), and
  Milestones 5 to 7 mirror inner scroll regions such as app-shell panels and
  add a "Scroll together" toggle; the contract (Milestone 5), mockups
  (Milestone 6) and runtime (Milestone 7) are delivered. Implementation is
  complete; move this plan to Completed when its implementation PR merges.
- [Viewer Dark Mode](./viewer-dark-mode.md) — shared viewer appearance, one
  standalone Auto/Light/Dark control for interface and previews, and
  host-owned theme with independent previews when embedded. Dark neutrals align
  with Mokly Cloud. Implementation is complete; move this plan to Completed when
  its implementation PR merges.
- [Release-Gated Node Compatibility](./release-gated-node-compatibility.md) —
  run the minimum supported runtime on ordinary changes and reserve the full
  Node 22.14/24 compatibility matrix for Release Please pull requests.
- [Screen Variants Follow-up](./screen-variants-follow-up.md) — implementation
  verified for the six-route design-catalogue conversion and five review
  fixes from PR #101; pushed and reviewed in
  [PR #115](https://github.com/mokly-ai/mokly/pull/115). The historical
  snapshot-selection and mockup parity fixes are verified, pushed and
  reviewed. Mainline Appearance integration is verified, pushed and reviewed.
  The plan stays Active until merge. Later navigation ideas
  remain non-blocking follow-ups.
- [Co-Located Entry Discovery Follow-up](./co-located-entry-discovery-follow-up.md)
  — all deferred seventh/eighth-round findings, the latest entry-layout
  documentation finding, and the remaining follow-up tasks from PR #101;
  implemented, independently verified, pushed, and reviewed with no actionable
  findings; [PR #111](https://github.com/mokly-ai/mokly/pull/111) awaits merge.
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
- [Id-Derived Routes, Unified Variants, And Identity-Keyed Wire](./id-derived-routes.md)
  — identity is kind plus id: documents derive as `screens/<id>.html`,
  `pages/<id>.html`, `user-flows/<id>.html`, and `components/<id>.html`;
  authored `route`, `slug`, `segment`, and `path` go away; component
  variants become entries with global ids like screen variants; the
  manifest, read model, review result, and viewer indexes drop every
  derivable path field and key on id; and the static export writes each
  shell once without the `id/<id>/index.html` alias. No backwards
  compatibility. Milestones 1–23 are implemented, verified, pushed, and
  reviewed on `calummoore/halifax-v2`; the third follow-up review's 9 findings
  await the user's decision, and the plan stays Active until its pull request
  merges.

## Completed

- [Screen Variants](./screen-variants.md) — PR #101's delivered scope is
  complete: authoring, navigation, Changes, per-view evidence, and the approved
  review fixes. Unfinished work is owned by
  [Screen Variants Follow-up](./screen-variants-follow-up.md).
- [Co-Located Entry Discovery](./co-located-entry-discovery.md) — PR #101's
  delivered scope is complete through Milestone 13. Historical milestones and
  reviews remain in `co-located-entry-discovery/`; open work is owned by
  [Co-Located Entry Discovery Follow-up](./co-located-entry-discovery-follow-up.md).
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
