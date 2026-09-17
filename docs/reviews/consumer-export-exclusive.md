# Consumer Export: Exclusive Destination Follow-Up

The user approved both findings in the
[preceding review](./consumer-export-followup.md). This record tracks their
implementation on [PR #49](https://github.com/mokly-ai/mokly/pull/49), without
reopening completed milestones or authorizing an automatic new-finding cycle.

The user subsequently approved the separate dependency item below. Its
[focused follow-up](./dependency-security.md) tracks that work and supersedes
the historical decision-needed status in this record.

## Approved Findings

1. **High — Concurrent export destinations could be replaced.** Group:
   filesystem transactions. Independently confirmed: nine new regression
   assertions failed against the previous implementation, including an empty
   destination appearing at the exact stage-install or backup-restore call.
   Initial absence, root identity changes, and a captured replacement were not
   retained as part of transaction authority. Doing nothing could discard a
   late copied export or replace another process's empty directory.

   Options considered: A) retain exact initial identity and share an
   OS-enforced no-replace rename for capture/install/restore; B) add another
   existence check; C) weaken the replacement contract. Recommended and
   implemented: A. The native bridge is an intentional runtime dependency,
   avoiding the remaining check-to-rename race in B and the partial visible
   output of a copy-based workaround. The rest of the exporter remains in
   TypeScript; fixed native signatures and flags live at one narrow boundary.
   Unsupported operations fail closed, and no existing dependency version
   changed. Protocol, README, and required platform CI cover the new contract.

2. **Low — Completed release bootstrap appeared to be current procedure.**
   Group: release docs. Independently confirmed against the package, release
   manifest, and workflow; the drift was already present on main. Doing nothing
   could cause maintainers to repeat bootstrap steps or reset release state.

   Options considered: A) document current release-managed version sources and
   release/retry workflow, retaining bootstrap as completed history; B) add a
   historical label only. Recommended and implemented: A. The documentation
   no longer needs to be edited on every package-version change. Versions,
   release configuration, publication permissions, and workflow behavior are
   unchanged.

## Verification

- Added 16 regressions covering initial inspection, late empty/owned output,
  identity substitution/removal, capture substitution, install and restore
  races, native destination kinds, Unicode paths, invalid native paths, and
  unavailable native support. Nine failure assertions reproduced before the fix.
- All 112 focused export/release tests pass locally on macOS Node 24.2.0.
- Clean Linux Node 22.14.0/npm 11.7.0 passed all 31 native/transaction/recovery
  tests after a normal dependency install, with no consumer compiler step.
- An initial macOS full-gate attempt stopped in the test phase: the repository
  preview correctly rejected changed-path evidence when review notes were added
  during generation, and three watcher starts timed out under heavy host load
  (load average above 298 on 14 CPUs). The unchanged preview tests and all three
  watcher tests passed independently. No deadlines or assertions were relaxed.
- The complete `cargo xtask check` passed against the same source in a frozen
  clean Linux checkout with real Git history: all 594 unit/integration tests,
  105 browser tests, and three Rust tests passed, along with formatting, lint,
  typechecking, generated-example verification, package/license checks, packed
  consumer smoke tests, Rust formatting/Clippy, and the 10-file Rust length audit.
  The first Linux browser attempt lacked the default Google Chrome executable;
  rerunning the complete gate with the installed Chromium browser selected via
  `PLAYWRIGHT_CHANNEL=chromium` passed. No product or test code changed between
  those attempts. Focused required macOS/Windows CI results are recorded below.
- At initial verification main was `a5ecbc0`, already merged, with no mainline
  file deletions. See the subsequent integration below for newer mainline work.

## Latest Main Integration

Implementation `95bee11` was committed and pushed after the passing gate. The
first post-push review was deliberately interrupted when GitHub reported the
PR conflicted with newly advanced main; it produced no completed findings.
Source tip `95bee115f626a65611f93e83bd634e6c3524b3a8` was captured before fetching
main `aa5adea1b7d00fbfc4c3c3cf5e95c553635ccd2f` from base `a5ecbc0`.

All 36 incoming paths were audited. Main's icon sizing, shell controls, generated
design examples, and associated tests are preserved. Five watcher-test files
conflicted because both branches independently added semantic Changes polling.
Resolution retains main's `changedCount`, `waitForChangedCount`, and
`waitForUpdate` interfaces and all three HTTP-backed tests; this branch's six
additional deterministic polling tests move to a separate file. The controlled
remove/repair recovery assertion and version-rich timeout diagnostics remain.
No polling deadline, recovery assertion, or mainline feature was removed.

All nine polling tests passed after resolution. The complete post-integration
`cargo xtask check` also passed on macOS Node 25.4.0/npm 11.7.0: all 598
unit/integration tests, 107 browser tests, three Rust tests, and every formatting,
lint, typechecking, generated-example, package/license, packed-consumer,
Rust formatting/Clippy, and file-length gate. The earlier Linux/Node 22 and
macOS/Node 24 results describe the pre-merge source; required supported-runtime
and native-platform CI subsequently verified the merge after its push.

No mainline file deletions or unresolved conflicts remain. Integration was
committed and pushed as `4f944b0` before the final review. All 19 additional
post-commit preview/watcher/polling smoke tests passed on macOS Node 24.2.0.

## Post-Push Review And CI

The final `cargo xtask review` completed successfully against `4f944b0` and
`origin/main` (`aa5adea`) with **no actionable findings**. This follow-up used two
of the skill's ten allowed command invocations: the first was interrupted for
new mainline integration; the second completed. There are no unaddressed or
rejected items from the completed pass. The two approved issues above are fixed
in the filesystem-transactions and release-docs groups.

The reviewer inspected the committed source read-only, confirmed a clean
whitespace/deletion audit, and checked npm's current primary release docs. It did
not run tests; the independent local and CI verification reported here supplies
that evidence. Native/filesystem differences remain a release consideration,
covered by real Linux, macOS, and Windows tests rather than assumed from review.

[CI on the integrated commit](https://github.com/mokly-ai/mokly/actions/runs/34409892855)
passed both complete Node 22/24 gates, both native platform jobs, and Required CI.
Each complete gate passed 598 unit/integration tests, 107 browser tests, and
three Rust tests. The [PR preview](https://github.com/mokly-ai/mokly/actions/runs/34409892871)
also deployed successfully.
The first Node 24 attempt passed all 598 unit/integration tests and 106 browser
tests, but one unchanged mobile sandbox-navigation test could not observe the
destination element within its existing five-second assertion deadline. This
test is identical on main. All ten unchanged, trace-enabled local repeats passed
on Node 24; the original CI run did not retain a trace, so its exact cause is not
proven. The unchanged Node 24 job then passed the complete gate on its second
attempt, including all 107 browser tests. No product code, assertion, deadline,
or retry configuration was changed to accommodate the failure.

## Separate Dependency Audit — Needs Decision

3. **High — Existing dependency advisories remain.** Group: dependency
   maintenance. `npm audit` reports 11 High and one Moderate affected packages;
   the production-only audit reports one High in `brace-expansion@5.0.7`, reached
   through the existing glob dependency. That same locked version exists on
   main, and the native-bridge install changed no existing locked versions.
   Koffi and its platform packages are not flagged in the report.

   Doing nothing retains a reported memory-exhaustion risk for crafted brace
   patterns; the development-tool advisories also need reachability assessment.
   See the upstream [brace expansion advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895).
   Options: A) perform a focused runtime/tooling dependency update, inspect the
   full audit paths, and rerun the complete gate; B) explicitly accept a bounded
   deferral after assessing exposure. Recommended: A as separately approved
   dependency maintenance. No automatic `npm audit fix` or unrelated upgrades
   were performed. Release docs no longer claim an old override proves a
   currently audit-clean tree.

## Delivery

The fixes are pushed as `95bee11`, with latest-main integration in `4f944b0`,
a clean completed post-push review, and all required code CI passing. This
documentation-only closeout records the completed milestones and PR summary;
no production source changed after the reviewed implementation. The separate
dependency recommendation remains for the user's decision. No npm release or
PR merge was performed.
