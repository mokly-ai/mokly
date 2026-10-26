# Port the CLI Tests to Rust

Status: Active. On branch `calummoore/mokly-tests-rust-migration`, no pull
request yet. The plan closes when its PR merges.

After the [Rust rebuild](./rust-rebuild.md), 70 test files under `tests/`
still check the behaviour of the native `mokly` binary from Node: 67 Node
tests and 3 browser specs that read JSON only. They start the binary through
the shim, inject faults, run a fake receiver and a fake npm registry, and read
the output with the viewer's TypeScript readers. Together with the Node
helpers that only they use, they are about 11,200 lines. This plan ports each
case to a Rust integration test of `mokly-cli`, one area per milestone. It
compares each case with the existing Rust tests first and drops the
duplicates. It deletes the Node tests and the Node helpers that only they use.

User decision 1 B, 2026-10-26: port all 70 files to Rust integration tests,
one area at a time, drop the duplicates, share the fake HTTP server of
`mokly-publish` through a new test-support crate, and delete the Node tests
and their helpers. The ported tests also run in the native job, which adds
macOS and Windows coverage and CI time. Rejected: A, keep the tests in Node;
C, also keep one Node contract test that reads the ported outputs with the
viewer readers. Reason: the user prefers tests in Rust where possible.

Not covered: the Node tests of TypeScript code, the browser UI specs, and the
Node tooling tests. User decisions 2 B and 3 B move the repository file rules
and the scripts that `xtask` calls to `xtask` under their own plans. User
decision 4 B deletes the rebuild comparison tooling in a separate workspace.

Baseline on 2026-10-26: the 67 Node files run 218 tests in 131 seconds with
four files at once on an 8-CPU machine. The CI jobs on `main` took 14.3
minutes for Repository, 16.7 for Viewer, 7.3 for macOS Native, and 37.1 for
Windows Native, against 75- and 60-minute job limits.

Contract owners:

- [CI verification](../docs/protocol/ci-verification.md) and
  [CI test timing](../docs/protocol/ci-test-timing.md): the Rust tests of
  every crate run in Repository and Native, under the same assertion rule.
- The [CLI tests README](../crates/mokly-cli/tests/README.md).
- The [mokly-compare README](../crates/mokly-compare/README.md): its test
  notes name the Node base-tier tests.
- The [mokly-publish README](../crates/mokly-publish/README.md) and the new
  `mokly-test-support` README.

## Milestone 1: Documentation

No product requirement changes. The docs state where the binary's end-to-end
tests live.

- [x] State in the CLI tests README that the binary's end-to-end behaviour is
      tested in `crates/mokly-cli/tests`, one test binary per area, with the
      shared fixtures of `mokly-test-support`.
- [x] Confirm that no protocol doc names a Node test that this plan moves.
      Only the mokly-compare README names some; Milestone 6 updates it.

## Milestone 2: Shared test support

A dev-only crate holds the fixtures that more than one test crate or area
needs. Each later milestone adds what it needs first.

- [x] Create `crates/mokly-test-support` with `publish = false`, a README,
      and module docs.
- [x] Move the fake HTTP server from `crates/mokly-publish/tests/support` to
      the crate, and switch the `mokly-publish` tests to it.
- [x] Add the binary command with the package root and viewer environment,
      the publication and Changes fixtures, Git and file helpers, the fake
      receiver, the independent upload readers, the model readers, timing
      records, and output identities. The milestone that first needs the
      installed shim or a consumer project adds it.
- [x] Run `cargo test -p mokly-publish -p mokly-test-support`, Clippy,
      formatting, and the Rust file-length lint.

## Area milestones

Each area milestone follows the same steps:

1. Map each Node case to an existing Rust test that proves every assertion,
   or to a new port. Save the map under `.context/port-cli-tests-to-rust/`.
2. Port the remaining cases to one test binary for the area,
   `crates/mokly-cli/tests/<area>_tests.rs` with its module folder. Keep
   every assertion. Keep the POSIX-only cases under `cfg(unix)`.
3. Delete the area's Node tests and the Node helpers that only they use.
4. Update each README and doc that names a deleted file.
5. Run the area's Rust tests, Clippy, formatting, the Rust file-length lint,
   and the Node tests that share a touched helper.

## Milestone 3: Publish

Evidence: `.context/port-cli-tests-to-rust/publish.md`.

- [x] Port `static_publication`, `static_publication_acceptance`,
      `static_publication_assets`, `static_publication_cases`,
      `static_publication_comparison`, `static_publication_inspector`,
      `static_publication_replan`, `static_publication_unavailable`,
      `static_publish_directory`, `static_checkout_acceptance`,
      `static_changes_publication`, and `static_cancellation`.

## Milestone 4: Changes and comparison output

- [ ] Port `static_changes_capture`, `static_changes_classification`,
      `static_changes_contents`, `static_changes_inputs`,
      `static_changes_reference`, `static_changes_removed_component`,
      `static_changes_state`, `static_changes_styles`,
      `static_changes_timing`, `static_changes_views`,
      `comparison_review_bytes`, `serve_capture_timing`, and
      `static_capture_timing`.
- [ ] Port the browser specs `static_comparison_output` and
      `static_moved_fixture`, which read JSON only.

## Milestone 5: Recovery, signals, and input safety

- [ ] Port `static_recovery_paths`, `static_recovery_process`,
      `static_recovery_signals`, `static_git_cancellation`,
      `static_compiler_diagnostics`, `static_fault_seam`,
      `static_input_boundary`, `static_resources`, and
      `mokly_serve_signals`.

## Milestone 6: Base dependency tiers

- [ ] Port `static_base_classic_paths`, `static_base_manager_mirror`,
      `static_base_managers`, `static_base_registry`, `static_base_secrets`,
      `static_cold_base_tiers`, and `static_dependency_timing`.
- [ ] Keep the hosted CI defaults coverage of `static_base_manager_ci`:
      run the ported manager and tier cases with `CI=true` and
      `GITHUB_ACTIONS=true`.
- [ ] Update the test notes in the mokly-compare README.

## Milestone 7: JavaScript rendering through the sidecar

- [ ] Port `sidecar_callback_exports`, `sidecar_callback_mutation`,
      `sidecar_callback_pages`, `sidecar_callback_slots`,
      `sidecar_postcss_async_loader`, `sidecar_postcss_write_evidence`,
      `sidecar_stderr_exit`, `sidecar_stderr_shutdown`, `sidecar_timings`,
      `sidecar_wrapper_validation`, `static_postcss_base_evidence`,
      `static_postcss_evidence`, `static_postcss_identity`,
      `static_postcss_ranges`, `static_fragment_timing`,
      `static_viewer_assets`, `serve_generation_release`,
      `mokly_serve_javascript`, and `browser_host_parent_death`.

## Milestone 8: Controls and numbers

- [ ] Port `control_bounds_warnings`, `control_order`,
      `unsafe_control_numbers`, `unsafe_control_warnings`,
      `unsafe_integer_props`, and `unsafe_schema_numbers`.

## Milestone 9: Example design catalogue

- [ ] Port `design_catalogue` and the browser spec `design_adoption`, which
      reads JSON only.

## Milestone 10: Unused Node harness

- [ ] Delete each Node harness test and helper that no remaining test uses,
      such as the publication, signal, and Serve helpers and their own
      tests. Record the search that proves each one dead.
- [ ] Update the docs and READMEs that name them.

## Milestone 11: Verification, commit, review, and pull request

- [ ] Record the Rust test duration of `mokly-cli` before and after the port
      under `.context/port-cli-tests-to-rust/`.
- [ ] Run a manual CI run of the branch and check that both native jobs pass
      within their limits.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
