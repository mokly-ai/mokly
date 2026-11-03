# Remove own-output checks from the sidecar wire and the pipeline

Status: Active. On branch `calummoore/remove-own-output-checks`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Source implementation is ready. Verification, review, and the pull request
remain in Milestone 13. The user requested a source checkpoint before the
full gate and review on 2026-11-03.

The user approved all milestones and tasks on 2026-11-03. This request
authorizes the listed removals and the proven-invariant serialization
conversions. The shared skills remain outside this repository's scope.

Mokly checks much of the data that its own code produced, often in two or
three copies. An inventory of 2026-11-03 found about 6,300 lines of such
checks and about 4,700 lines of tests for them, in
`.context/remove-own-output-checks/`. The copies drift: for example, the
viewer rejects catalogues that the build accepted. On 2026-11-03 the user
chose that Mokly checks data once, where it enters from outside, and trusts
what its own code of the same version produced.
[Decisions](./remove-own-output-checks/decisions.md) records the decisions
and my design calls with their dates.

The plan `plans/viewer-checks-from-rust.md` on branch
`calummoore/rust-viewer-checks-plan` covers the read model: the viewer
readers, `privacy.ts`, the viewer error boundary, the `mokly-model` readers,
which stay only as Mokly Cloud's upload check, and Mokly Cloud. This plan
covers the sidecar wire on both sides, the core's second checks of its own
output, the pipeline crates with the review and snapshot validators of
`mokly-model`, and the viewer shell guards in files that the other plan does
not change. It keeps every boundary check, version gate, fence, the sidecar
hello, and the frame size limits. It does not change copies of derivations,
such as `packages/viewer/src/shell/catalogue_branch_point.ts`, or the agent
rules, which the user changes in `futex-ai/skills`.

Contract owners:

- [Render sidecar](../docs/protocol/mokly-sidecar.md), with its
  [modules](../docs/protocol/mokly-sidecar-modules.md),
  [render records](../docs/protocol/mokly-sidecar-render-records.md),
  [PostCSS](../docs/protocol/mokly-sidecar-postcss.md), and
  [lifecycle](../docs/protocol/mokly-sidecar-lifecycle.md) pages.
- [Component props](../docs/protocol/mokly-component-props.md): the wrapper
  sentences only. The other plan edits the viewer and core sentences.
- [Catalogue serialization](../docs/protocol/mokly-catalogue-serialization.md):
  the sentence on the core reading its own output only.
- [Component workspace design](../docs/protocol/mokly-component-workspace-design.md):
  the public reasons filter.
- The READMEs of `packages/mokly`, `packages/viewer/src/shell`, and each
  changed crate.

Replaced ways:

- An optional `compiled` recipe in the sidecar bundle result, with a replay
  that bundles again from disk → a required `compiled` recipe. Consumers:
  `crates/mokly-sidecar/src/pool_preparation.rs`, `pool_exchange.rs`,
  `presentation.rs`, and `error.rs`; `crates/mokly-render/src/bundle_attempt.rs`
  and `render_environment.rs`; the generated wire type; the replay fixtures
  in `pool_reload_tests.rs`, `pool_replay_tests.rs`, `pool_lease_tests.rs`,
  and `pool_edge_tests.rs`. Moved and deleted in Milestone 4.

Each code milestone below follows the same rules:

- Remove a check only when its data comes from Mokly's own code of the same
  version. Keep the boundary part of a mixed check. The inventory reports
  give the class of each check.
- Remove each test that covers only a removed check, under the removal rule
  of the `testing` skill. Move every other assertion of a changed test.
- Update each README that names removed code.
- Run the targeted tests of each changed package and crate.

## Milestone 1: Documentation and protocol — completed

Depends on: none

The protocol pages stop requiring checks of data that the other side of the
same version writes. The writer rules, the hello gate, the version gate, and
the frame size limit stay.

- [x] `docs/protocol/mokly-sidecar.md`: remove "an unknown method" from the
      `sidecar-protocol` row. Add the decision in force next to the frame
      rules: each side trusts the frames that the other side of the same
      version writes, and checks only author data. Name the rejected
      alternative, checks of every frame field on both sides, and its
      reason, drift and code size.
- [x] `docs/protocol/mokly-sidecar-modules.md`: remove the requirement to
      check the order of the class maps.
- [x] `docs/protocol/mokly-sidecar-render-records.md`: remove the render-time
      state checks and the slot check. Change "The core validates drafts,
      reconciles them" so that the core only reconciles the drafts with the
      markers.
- [x] `docs/protocol/mokly-sidecar-postcss.md`: remove the check of a
      PostCSS context's roots. `mokly-sidecar-lifecycle.md`: remove any
      guard rule against a closed session.
- [x] `docs/protocol/mokly-component-props.md`: in the wrapper sentences,
      keep the copy of the props and the check of the props before the
      adapter runs. Remove the wrapper's check of the schema.
- [x] `docs/protocol/mokly-catalogue-serialization.md`: remove "The core
      reads only its own output and rejects an unknown or misplaced field".
- [x] `docs/protocol/mokly-component-workspace-design.md`: remove the
      requirement that the shell filters reasons that contradict their
      record.
- [x] Run `npm run format:check` and `tests/markdown_links.test.ts`.

## Milestone 2: Sidecar requests in TypeScript — completed

Depends on: 1

The sidecar stops checking the requests that the Rust binary writes. The
Rust types already fix their shape. Author code runs in the sidecar, so the
request checks protect nothing.

- [x] Remove the request shape checks in `packages/mokly/src/sidecar/requests.ts`,
      `parameter-shapes.ts`, and `request-id.ts`, and the duplicate-key,
      inbound size, UTF-8, and partial-frame checks of `transport.ts`. Keep
      the JSON decoding, the frame split, and the outbound size limit.
- [x] Remove the order and state checks that the Rust pool already
      guarantees: `session.ts` (class maps, bindings, render state),
      `evaluate.ts`, and `render.ts`. First confirm each guarantee in the
      Rust pool code, also for the recovery of one entry in Serve. Keep the
      hello order.
- [x] In `render.ts`, keep the copy of the request props and remove the
      second plain-data check.
- [x] Remove the `validatePropSchema` call of the wrapper in
      `packages/mokly/src/authoring/components.ts`. Keep `validateProps`.
- [x] Remove the loader checks in `bundle.ts` and `postcss-source.ts` that
      the config schema already makes, and the PostCSS context checks in
      `postcss.ts`.
- [x] Remove the environment cleanup that the binary already does. Tests
      that start the sidecar alone set the same environment.
- [x] Remove the internal invariant checks and the checks of messages
      between the sidecar's own processes, as the inventory lists them.
      Keep the marker checks in `markup-records.ts`, because author output
      surrounds those markers.

## Milestone 3: Sidecar responses in Rust — completed

Depends on: 1

The binary stops checking response fields that only Mokly's TypeScript
writes. It keeps the JSON decoding of each frame, the hello and version
gate, and the inbound frame size limit.

- [x] Remove the response id check and the envelope checks beyond decoding
      in `crates/mokly-sidecar/src/wire.rs` and `codec.rs`.
- [x] Remove `deny_unknown_fields` from the 29 response payload types and
      the 15 request types of `crates/mokly-sidecar`.
- [x] Remove the null-result check, the one-value `Coverage` check, the
      hello variant check, and the guards against a closed session or a
      request before hello.
- [x] Remove the unknown-generation check after you confirm that no Serve
      release can race a render. Remove the stdio handle check, the
      `ResultKind` errors, the marker-without-draft check in
      `crates/mokly-render/src/fragments.rs`, and the fallbacks for values
      that an earlier stage guarantees.
- [x] Replace each poisoned-lock error with `PoisonError::into_inner`.

## Milestone 4: Sidecar wire format — completed

Depends on: 2, 3

Two wire fields change on both sides, so this milestone follows the two
sidecar milestones.

- [x] Make `compiled` required in the bundle result. Delete the replay that
      bundles again from disk and its `GenerationChanged` path. Move the
      replay fixtures to real `compiled` recipes.
- [x] Remove the warning lists of the sidecar results, which carry nothing
      that the binary reads. Remove the closed `WarningCode` set.
- [x] Update the sidecar protocol examples and result requirements for
      required compiled recipes and removed warning lists.
- [x] Regenerate the TypeScript wire types with `cargo xtask generate-types`.

## Milestone 5: Comparison self-checks — completed

Depends on: 1

`mokly-compare` stops checking its review result and its change snapshot
right after it built them.

- [x] Align the CSS attribution membership page with the removed
      `review-invalid` self-check. Keep its writer requirements.
- [x] Remove retained proof metadata used only by the retired validator.
      Keep exact instance selection on the production attribution path.

- [x] Delete `crates/mokly-compare/src/source_validation.rs` and
      `impact_validation.rs`, their call in `comparison.rs`, and
      `Error::Review`.
- [x] Remove the call of the snapshot validator in `snapshots.rs`.
- [x] Delete the review and snapshot validators of `crates/mokly-model`:
      `review_validation.rs`, `review_affected_validation.rs`,
      `review_sides.rs`, `snapshot_validation.rs`, `snapshot_order.rs`,
      `snapshot_source_order.rs`, and `record_validation.rs`. Delete the
      test-only readers `readers::review` and `readers::change_snapshot`,
      and their `ContractViolation` variants.
- [x] Remove the impossible-state checks of `mokly-compare`: the usage-ready
      check, the move and generation checks of `lookup.rs`, the missing base
      records, the missing composed trees, pairs without a side, a resource
      fact missing after its insert, the capture decode errors, the index
      range checks, the owner cycle check of `affected.rs`, the second git
      batch count, and the dead `Poisoned` variant.

## Milestone 6: Pipeline self-checks — completed

Depends on: 1

The other pipeline crates stop checking what an earlier stage of the same
run produced.

- [x] `mokly-graph`: remove the missing-tree and missing-key checks.
- [x] `mokly-html`: remove the owner cycle check of `fragment_rebase.rs` and
      the dead duplicate-key branch of `fragment_validation.rs`. Keep the
      other checks of `fragment_validation.rs`, `normalized_keys.rs`, and
      `regions.rs`.
- [x] `mokly-catalogue`: remove the compile check of the embedded config
      schema, the controls check that an earlier check already made, the
      dead variant fallback of `validate_templates.rs`, and the root path
      checks that the config schema already makes.
- [x] `mokly-graph` and `mokly-watch`: remove the second compile check of
      the config globs. Keep it for the globs that PostCSS results supply.
- [x] `mokly-git`: remove the zero-budget check and `BoundedRunner`, which
      has no production caller.

## Milestone 7: The core's second checks of its own output — completed

Depends on: 1

The core stops reading back and checking the files that it built a moment
earlier in the same process.

- [x] `mokly-static`: remove the second reads of the index and the details
      in `assembly.rs` and `comparison_output.rs`, the second size and
      inventory pass, and the impossible plan, usage, and range states that
      the inventory confirms. Keep one parse of the viewer scripts. Keep the
      path check of the final inventory, and remove its marker parse and
      file hashes.
- [x] `mokly-server`: remove the second reads in `snapshot.rs`,
      `detail_encoding.rs`, and `comparison_metadata.rs`, and the repeated
      sorts and copies.
- [x] `mokly-publish` and `crates/mokly-model/src/output`: remove the second
      parse of the marker and the manifest, the second hash of each file,
      the index base check, and the duplicate-key stream. Keep the upload
      file count and size limits.
- [x] `mokly-cli`: remove the publication artifact check, the dead
      `BuildError::Deferred` path with `DeferredDefinitions` in
      `mokly-catalogue`, the dead `Failure::Unavailable`, and the repeated
      sidecar count checks.

## Milestone 8: Viewer shell guards — completed

Tags: ui

Depends on: 1

The shell stops guarding against read-model states that the core cannot
write. This milestone owns the narrow guard removals below. The other plan
owns reader rewrites in the shared delivery files. Workspace 461 merges
these edits before its final gate.

- [x] Remove the `try`/`catch` in `shell/frame_instances.ts`, the second
      checks of a fenced detail in `previews/content.ts` and
      `previews/request.ts`, and the empty side-list check in
      `previews/snapshot_address.ts`.
- [x] Remove the unknown-field rejection in `review/page_preview.ts` and the
      stream checks in `standalone/live_source.ts`.
- [x] Remove the reasons filter in `shell/public_reasons.ts`.
- [x] Remove the throws and fallbacks for missing parents, ancestors, steps,
      and required values that the inventory lists, in `shell/`,
      `registry/`, `client/`, and `packages/ui/src/catalogue-tree`. Keep the
      guard for a live publication that replaces the catalogue, and the
      title fallbacks for render answers.
- [x] Delete the dead rule rebuild in `shell/workspace_stylesheet_evidence.ts`
      and the test-only `initialDetails` fence of `ShellStoreProvider`.

## Milestone 9: Shell store guards — completed

Tags: ui

Depends on: 8

- [x] Replace each `useOptionalShellStore()` call with the required store.
      Remove the `store?.` defaults and the missing-key defaults of
      `nav_rows.ts` and `nav_leaf_rows.ts`. Give each test that renders a
      container without a store a `ShellStoreProvider`.

## Milestone 10: Serialization that cannot fail — completed

Depends on: 3, 5, 6, 7

The user's approval of every task on 2026-11-03 authorizes the listed
proven-invariant conversions. The shared skill update remains outside
this repository.

- [x] Replace each `Result` of serializing Mokly's own types with `expect`
      and a reason, in about 52 call sites of the pipeline crates and in
      `mokly-model`, `mokly-static`, `mokly-server`, and `mokly-render`.
- [x] Delete the error variants that then have no producer.

## Milestone 11: Preserve the ownership marker byte limit — completed

Depends on: 7, 10

The marker is a regular output file. Its existing 64 MiB limit must remain
at the writer after the second parse goes. A large inventory must not write
a marker that the next build cannot read.

- [x] Keep the marker byte limit directly after encoding, without a parse
      or a second hash.
- [x] Add one regression with valid portable paths that exceed the existing
      marker byte limit. Prove its failure before the fix and its pass after.
- [x] Keep the fixture's unique prefix early so sorting avoids long shared
      prefixes.

Evidence: `.context/remove-own-output-checks/marker-limit-report.md`.

## Milestone 12: Review corrections

Depends on: 6, 7, 11

Keep the existing output limit for generated metadata at its first inventory
admission. Correct the remaining Git integration advice.

- [x] Prove the oversized generated-index regression before the fix.
- [x] Admit index, current detail, and deployment files through Inventory
      before finalization. Keep earlier admissions and all encoded bytes.
- [x] Name the supported Git interfaces and correct the batching paragraph.
- [x] Record the shared admitted-file-set API as a separate follow-up.
- [ ] Run focused tests, the complete gate, and one fresh review of the fix.

## Milestone 13: Verification, commit, review, and pull request

Depends on: every other milestone

- [x] Integrate shared security fix `9447445` from PR #282 before the
      complete gate. The user directed this integration on 2026-11-03.
      Do not duplicate its dependency patch.
- [x] Remove the obsolete binary-test case for a second zero-sidecar
      normalization. Keep positive counts and the original input validation.
- [x] Supply normalized sidecar counts in the two integration fixtures
      that call the private runtime directly. Keep the real CLI boundary.
- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [x] Merge `origin/main`, with the branch of the other plan when it merged
      first, and resolve the shared lines of `mokly-component-props.md`,
      `mokly-catalogue-serialization.md`, and `crates/mokly-model`.
- [x] Commit with Conventional Commits and push the branch.
      Evidence: `.context/remove-own-output-checks/complete-gate-final.log`.

- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
