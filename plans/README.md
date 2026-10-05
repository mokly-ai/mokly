# Plans

## Active

- [Move `@mokly/mokly` Into `packages/mokly`](./mokly-workspace-package.md) —
  make the CLI a real workspace member beside `packages/viewer`: private
  workspace root, `packages/mokly` package manifest, build-time copies of the
  shipped guides and protocol docs, rewritten test and script paths, and
  Release Please keyed on `packages/mokly` with unchanged `vX.Y.Z` tags. The
  tarball layout stays identical. Created 2026-10-05; Milestone 1 is next.
- [Path Identity, Spec Tree, And Markdown Documents](./path-identity.md) —
  replace `id` and `navPath` with one file-derived path per entry, add
  Markdown documents, detect moves, rename Pages to Specs, and make folder
  rows browse-only; manifest v8, read model v4, review result v5. Created
  2026-10-02; contracts, shell mockups, identity core, main integration,
  review fixes, Markdown documents and move detection with their review
  fixes, viewer navigation and its review fixes, index entry mockups,
  document typography parity, the light-only document, member landing view
  and moved comparison wording mockups, the document presentation and
  index-entry Changes rows, and the Moved presentation with its review fixes
  are complete. Main and the final viewer branch are integrated through
  Milestone 6I. Milestone 6J completes source file-length compliance with the
  full gate passing. Milestone 8 guides, verification and Serve/static smoke
  tests are complete. The fresh implementation review is complete. The user
  approved a fix for each of its
  [eight findings](../docs/reviews/path-identity.md); Milestones 9–13 deliver
  them and end with a new review. Milestones 9–12 are complete and integrated
  through Milestone 13. The unmodified full gate and fresh smoke checks pass;
  all eight findings have recorded fixes and covering tests. A second fresh
  review found [fifteen new findings](../docs/reviews/path-identity.md#second-review).
  The user approved one shared branch-point lookup for five of them;
  Milestones 14–16 are complete. Milestone 17 integrated the shell consumers
  unchanged, passed the unmodified full gate (4,214 unit, 844 browser and 261
  hydration tests) and passed all five CLI smoke cases in Serve and export at
  desktop and mobile widths. The approved outcomes are recorded. A third
  fresh review found [six findings](../docs/reviews/path-identity.md#third-review),
  and Milestone 16 reported four more items. Milestone 18 fixes third-review
  item 9, which failed the pull request's CI, with one shared browser
  console rule; CI now passes, and its review found four Low findings. They,
  the other items, and the ten undecided second-review findings await the
  user's decision. The plan stays Active until its pull request
  merges.

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
- [Route-Scoped Shell Bootstrap](./route-scoped-shell-bootstrap.md) — Serve
  pages embed the catalogue index plus only their own entry's component usage
  and serialise that state once. The public `catalogue.json` stays complete;
  normalized non-client static content stays stable while viewer client changes
  update deployment identity. Implementation is complete; move this plan to
  Completed when its implementation PR merges.
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

- [Imported CSS Delivery](./imported-css-delivery.md) — delivered in PR #125
  (`ff376d7`): imported CSS, CSS Modules, binary assets and optional consumer
  PostCSS ship through Build, Check, Serve, export, publication and Changes.
  The plan Status lists each review round. The
  [Milestone 47 review](../docs/reviews/imported-css-delivery-milestone-47.md)
  findings were resolved after the merge in `ec04332`, and a generated-output
  writer race found while testing them is fixed in `01d5924` and `da916c0`;
  other unselected findings remain open in their review records for the
  user's decision.
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
