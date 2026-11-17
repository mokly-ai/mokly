# Use mimalloc in the Mokly binary

Status: Active. On branch `calummoore/mokly-mimalloc-global-allocator-i7qn`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly builds static mockup catalogues and computes Changes between Git revisions.
Allocator work consumes a large part of Changes processing on Linux.
Use mimalloc for Rust allocations in the `mokly` binary on all five release targets.
Keep normal command output, catalogue output, cache bounds, and protocol behaviour unchanged.
The requested `MIMALLOC_VERBOSE` check explicitly enables the allocator's own diagnostics.

The task message approves this approach and authorizes implementation, review, and an open pull request into `main`.
The performance orchestrator will merge the pull request.
Do not merge it in this workspace.

Contract owners:

- [Rust core architecture](../docs/architecture/rust-core.md).
- [CLI crate](../crates/mokly-cli/README.md).
- [Package protocol](../docs/protocol/mokly-package.md).
- [Developer test commands](../docs/protocol/developer-test-commands.md).

## Design and dated calls

The following calls belong to the performance orchestrator and are dated 2026-11-16.
The user delegated these design decisions to that orchestrator.
The user requested faster and more reliable Changes without changes that can exhaust machine memory.

1. Use the `mimalloc` crate with its default mimalloc version in `mokly-cli`.
   The supplied measurements used crate 0.1.52 with mimalloc 3.3.2.
   The crate currently selects mimalloc v3 by default.
   Add it with `cargo add`, without a version argument.
   Disable default features only when they enable features that the binary does not need.
   Set `#[global_allocator]` only in `crates/mokly-cli/src/main.rs`.
   Independent library test processes and other binaries retain the system allocator.
   Library code inside `mokly`, debug builds, and the binary's own unit tests use its global allocator.
   The reason is the measured CPU and memory improvement and support for all five release targets.
2. Reject jemalloc.
   It was as fast and used about 10% less peak memory than mimalloc in the supplied measurements.
   However, `tikv-jemallocator` does not support Windows MSVC.
   Its build-time page size also prevents a 4 KiB-page build from running on some Linux machines with larger pages.
3. Reject glibc allocator tuning, including `M_ARENA_MAX`.
   It can reduce fragmentation but keeps allocator CPU costs and does not apply to macOS or Windows.
4. Do not enable mimalloc's `override` feature.
   Rust allocations use mimalloc, and C libraries retain the system allocator.

### 1. Reduce allocator cost across release targets

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-cli/Cargo.toml` and `crates/mokly-cli/src/main.rs`.
- **Terms:**
  - **Changes:** Mokly's comparison between a catalogue and its pinned Git base.
  - **mimalloc:** A native allocator exposed through the Rust `mimalloc` crate.
- **Background:** The binary composes the Rust libraries for every command.
  Supplied release measurements show lower allocator CPU costs and peak memory with mimalloc.
  The release workflow builds Linux x64, Linux arm64, macOS arm64, macOS x64, and Windows x64.
- **Problem:** The system allocator consumes substantial CPU and memory during Changes on Linux.
- **Impact if no action:** Changes retains the measured allocator cost.
- **Root question:** How should the binary reduce allocation costs on every release target?
- **Options:**
  - **A.** Add mimalloc to the binary composition root on every target.
    Keep the existing memory bounds and command behaviour. Effort: Small.
- **Left out:**
  - Keep the system allocator. This fails the requested mimalloc goal.
  - Use jemalloc. This fails the Windows MSVC and variable Linux page-size requirements.
  - Tune glibc. This fails the macOS and Windows requirements and keeps allocator CPU costs.
  - Select different allocators by platform. This fails the requirement for mimalloc on every release target.
  - Configure allocations in a library. This breaks the approved binary-only boundary.
  - Reduce allocations in Changes. This is separate work and does not meet the allocator requirement.
  - Use another portable allocator. This breaks the explicit mimalloc choice.
  - Add a runtime allocator switch. This adds a new product input outside the approved scope.
  - Force collection after a Serve rebuild. This adds allocator tuning outside the binary composition root.
  - Fewer than three approaches remain because the task explicitly selects mimalloc and its binary-only boundary.
- **Assumptions:** All release targets use mimalloc, and existing behaviour and memory bounds remain unchanged.
  These are requirements from the task message, and their reasons still hold.
- **Wider fix:** A. The binary composition root selects one allocator for all Rust allocations in its process.
- **Previous examples:** None in the repository.
  The task supplies an uncommitted allocator experiment based on `331bf5d43`.
- **Recommendation:** A. It follows the supplied measurements and the performance orchestrator's approved calls.
- **Action:** fix now, apply A. The task already approves this design.

### 2. Preserve the C allocation boundary

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `crates/mokly-cli/Cargo.toml` and `crates/mokly-cli/src/main.rs`.
- **Terms:**
  - **override:** The mimalloc feature that replaces C allocation symbols.
- **Background:** Rust's global allocator selects an allocator for Rust allocations in one executable.
  Native C libraries can retain their own allocator boundary.
- **Problem:** Allocation interposition would extend this change beyond the approved Rust allocation boundary.
- **Impact if no action:** Enabling interposition would change C library allocation behaviour.
- **Root question:** Which allocations should the new allocator serve?
- **Options:**
  - **A.** Serve Rust allocations through the binary's global allocator and leave `override` disabled. Effort: Small.
- **Left out:**
  - Enable `override` on all or selected platforms. This breaks the task's explicit C allocation boundary.
  - Change each C library separately. This breaks the same boundary and adds unrelated work.
  - Add a gate that rejects `override`. Its disabled default already preserves the boundary without another gate.
  - Fewer than three approaches remain because the task explicitly preserves C library allocations.
- **Assumptions:** C libraries retain the system allocator, as the performance orchestrator's call of 2026-11-16 requires.
  This requirement still holds.
- **Wider fix:** A. One binary-level Rust allocator leaves native C allocation symbols unchanged.
- **Previous examples:** The release workflow already compiles C through `aws-lc-sys` and `ring`.
- **Recommendation:** A. It preserves the requested scope on every platform.
- **Action:** fix now, apply A. The task already approves this design.

## Replaced ways

- Implicit system allocation in the `mokly` executable becomes explicit mimalloc allocation.
  The executable is the sole consumer that moves in Milestone 2.
  There is no authored system-allocator implementation or converter to delete.
  Other executables and independent library test processes retain their current allocator.

## Milestone 1: Document binary composition

Depends on: none

Delegate this milestone to the `docs implementor` action.

- [x] Add one sentence to `docs/architecture/rust-core.md` on the binary's Rust allocator and its CPU and memory reason.
- [x] Keep protocol docs unchanged because observable behaviour does not change.

Milestone completed. The delegated report is `.context/global-allocator/docs-report.md`.

## Milestone 2: Select and inspect mimalloc

Depends on: 1

Delegate this milestone to the `non-ui implementor` action.

- [x] Inspect the crate's features and add it with `cargo add` to `mokly-cli`.
- [x] Set the global allocator only in the binary composition root, with no target restriction or `override` feature.
- [x] Keep the lockfile change limited to the added dependency and its necessary transitive dependencies.
- [x] Inspect release builds, binary inspection, dependency auditing, and native bootstrap for compatibility.
      Inspect the bundled allocator's runtime page-size handling for Linux hosts with larger pages.
- [x] Run Rust formatting checks and report the exact dependency version and feature selection.

Milestone completed. The delegated report is `.context/global-allocator/implementation-report.md`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

The orchestrator owns this milestone and checks each delegated result against its TODOs.
Check `df -h` and `free -m` before each large Cargo build.
Use `CARGO_INCREMENTAL=0` and bounded Cargo jobs.
Run Cargo builds one at a time.
Give each checkout its own target directory.

- [x] Run `cargo test -p mokly-cli` and `cargo xtask check --suite repository`.
- [x] Run the complete gate, `cargo xtask check`, and report each suite and any blocker.
- [x] Build release binaries from the last merged `origin/main` and this branch in separate target directories.
- [x] Run `MIMALLOC_VERBOSE=1 mokly --version` and save its allocator output.
- [x] Measure `examples/basic` builds with Changes and peak core RSS for both release binaries on the same catalogue and Git base.
- [x] After merging `origin/main` at `0b82cf6c0`, rebuild both release binaries and repeat the allocator and sanity checks.
      Preserve the earlier measurements under `.context/global-allocator/before-main-merge/`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push.
      Check every new finding, apply the fix rule, and run the second review round.
      Use at most two fix rounds and record each remaining finding as a follow-up item.
- [ ] Delete this plan after every other required TODO is complete and the review rounds are done.
- [ ] Open the pull request into `main`, preserve this plan's dated calls and permalink, and wait for its final CI.
      Dispatch `release-check.yml` on the final branch commit and report all five targets and packaging smoke checks.
      Leave the pull request open for the performance orchestrator to merge.

Evidence goes under `.context/global-allocator/`.
The conflict-free main integration audit is `main-integration-audit.log` in that folder.
Release evidence is in `mimalloc-verbose.stderr`, `sanity.json`, and `sanity-summary.json` in that folder.
Regression evidence is in `cli-tests-current-main.log`, `repository-check-final.log`, and `git-version-proof.json` in that folder.
The inherited older-Git issue is recorded in `plans/follow-ups/missing-blob-diagnostics-older-git.md`.
The options check and its disposition are in `plan-options-check.md` and `plan-options-disposition.md` in that folder.
Review reports go under `.context/reviews/calummoore/mokly-mimalloc-global-allocator-i7qn/`.

The complete local gate and the one unchanged-browser rerun are recorded in `.context/global-allocator/verification-summary.json`.
The separate static HTTP and file delivery checks are in `.context/global-allocator/delivery.log`.
