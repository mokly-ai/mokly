# Base Install Scripts And Manager Fixes

Status: Active. On branch `conductor/rust-rebuild-150-base-install-scripts-and-managers`, no pull request yet. The plan closes when its implementation pull request merges.

Base dependency installs disable lifecycle scripts by default. The current
implementation has eight follow-ups in that area. Yarn Classic can move a
script into a new Unix session, a script can inspect the parent Mokly process,
Yarn Berry can read TLS files named outside the base, and pnpm can stop on a
noninteractive modules-directory prompt. The scripts hint also misses base
render failures, the mode has several sources of truth, the hint lacks a
period, and the flags are silent with `--no-changes`.

This plan keeps the opt-in disabled until the owner answers the recorded
decisions. The implementation will make the process owner stop descendants,
apply the selected token policy, confine the selected manager settings, carry
one typed scripts mode through the install command, and present one typed
diagnostic for every base failure. It does not port item 154's end-to-end
tests, which workspace 353 owns, and it does not implement item 180's sidecar
environment change. The item 151 decision must state that its base-install
token rule does not change the sidecar environment owned by item 180.

Evidence from `origin/main` is saved under
`.context/base-install-scripts-managers/`:

- `probes/item150_yarn_classic_session.log` shows a Yarn Classic script and
  its child surviving group signals after a new session.
- `probes/item153_berry_tls_files.log` shows Yarn Berry opening all three
  configured TLS FIFOs outside the repository.
- `probes/item153_npm_pnpm_tls_files.log` shows the same wider file-read class
  for npm and pnpm. That wider class is a follow-up to the recorded item.
- `probes/item158_pnpm_prompt/result-with-dep.txt` shows pnpm 10.34.7 failing
  with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` and succeeding with
  `confirmModulesPurge=false`.
- `records/review-135b-record.md` holds the review findings and their exact
  options. `cargo-build-compare.log` and `npm-ci.log` record the earlier
  read-only build and install checks.

Contract owners:

- [Base Dependencies](../docs/protocol/mokly-base-dependencies.md).
- [Base Source And Dependency Preparation](../docs/protocol/mokly-base-preparation.md).
- [Terminal Errors](../docs/protocol/mokly-terminal-errors.md).
- [Comparison Package Selection](../docs/protocol/mokly-comparison-packages.md).
- [Git Command Runtime](../docs/protocol/mokly-git.md), for the shared
  process-tree ownership rule.
- [mokly-compare README](../crates/mokly-compare/README.md),
  [mokly-cli README](../crates/mokly-cli/README.md), and
  [mokly-platform README](../crates/mokly-platform/README.md).

The performance work owns `crates/mokly-cli/src/serve_services.rs`,
`crates/mokly-cli/src/static_runtime.rs`, and
`crates/mokly-cli/src/serve_delivery.rs`, plus the render-cache, stylesheet,
and `crates/mokly-git` changes. The implementation must preserve those edits
when it removes the configuration mutation or threads the effective mode.
The implementation must not edit `plans/rust-rebuild.md` until its final
bookkeeping milestone.

## Decisions

The following decisions are open. The recorded recommendations are proposals,
not defaults. No option is applied until the coordinator answers.

1. **User item 150, recorded review finding 42.** Severity High. The
   process owner must stop Yarn Classic scripts that leave the manager's Unix
   session. Option A documents the limit. Option B keeps scripts disabled for
   Classic on Unix and warns. Option C extends the Unix process owner to find
   descendants through parent links and signal every descendant, including new
   sessions. C is recommended because only it meets the existing stop-tree
   requirement. Effort: Large.
2. **User item 151, recorded review finding 43.** Severity Medium and
   security. Option A documents the `/proc/{pid}/environ` limit and advises
   `--no-base-install-scripts`. Option B keeps base scripts disabled when
   `MOKLY_TOKEN` or `--token` is present and warns. Option C uses a separate
   process space. B is recommended for the recorded scope. Effort: Small.
   Item 180 remains the separate sidecar environment decision. The protocol
   text must not claim that B protects the sidecar until item 180 is fixed.
3. **User item 152, recorded review finding 44.** Severity Medium. The
   current option A, a separate hint for preparation failures, is already on
   `origin/main`. Option B also shows the hint where Changes classifies the
   failure. Option C carries a typed scripts-off field with `Error::Base` and
   uses one helper in every presentation path. C is recommended because it
   covers preparation, capture, and later presentation paths together. Effort:
   Large.
4. **User item 153, recorded probe 145 B.** Severity Medium and security.
   Option A sends a base with `httpsCaFilePath`, `httpsKeyFilePath`, or
   `httpsCertFilePath` to tier three. Option B clears those settings. Option C
   confines them to the repository. A is recommended because it prevents the
   read without changing the base configuration. Effort: Small.
5. **User item 158, recorded pnpm CI fix finding 1.** Severity Medium.
   Option A passes pnpm's noninteractive `confirmModulesPurge=false` setting
   for private installs. Option B documents the CI-dependent tier. A is
   recommended because the private install can recreate its own directory
   without prompting. Effort: Small.
6. **User item 155, recorded review finding 51.** Severity Low. Option A
   removes the unused configuration mutation and passes the existing value
   through every phase. Option B stores the mode on the install `Command`, so
   environment construction reads the same value as argument construction. B
   is recommended because it removes argument-shape guessing. Effort: Medium.
7. **User item 156, recorded review finding 52.** Severity Low. Option A
   adds the final period. Option B also replaces the rich error hint with the
   scripts action so rich output has one recovery action. A is recommended for
   the smallest visible correction. Effort: Small.
8. **User item 157, recorded review finding 53.** Severity Low. Option A
   documents that the scripts flags have no effect with `--no-changes`.
   Option B rejects that pair. A is recommended because the command accepts
   other harmless unused input and the rejection would be a new gate. Effort:
   Small.

## Corrections And Planning Findings

- `crates/mokly-platform/src/unix.rs` uses `setsid` and signals only the
  manager's process group. `crates/mokly-compare/src/process.rs` owns the
  group but has no descendant enumeration. Windows already uses a kill-on-close
  job, so the Unix implementation is the item 150 focus.
- `crates/mokly-compare/src/process.rs` removes `MOKLY_TOKEN` from the child
  environment. It cannot remove the token from the already-running parent
  process, which is the item 151 read path on Linux.
- `crates/mokly-compare/src/manager_plan.rs` reads Berry root fields and
  validates ranges, but it does not inspect Berry's TLS file settings. The
  item 153 probe therefore reaches the manager with outside paths.
- `crates/mokly-compare/src/manager_command.rs` fixes pnpm's cache and module
  paths but does not set `confirmModulesPurge=false`. The item 158 probe uses
  the same pnpm behavior outside Mokly.
- `crates/mokly-compare/src/base_render.rs` captures the base after
  `NativeBase::prepare` returns. `crates/mokly-cli/src/changes_base.rs` wraps
  preparation and graph errors in `BaseInstallScripts`, but capture errors do
  not carry that wrapper. `changes_diagnostics.rs` therefore cannot show the
  hint for every render failure.
- `manager_command::variables` infers the mode from the first argument while
  `options::apply_base_install_scripts` mutates configuration and
  `PhasedChanges` stores another copy. These are the sources of truth covered
  by item 155.
- The wider TLS probe proves that npm and pnpm also open configured files.
  The recorded item covers Yarn Berry only. The broader npm and pnpm rule is
  an open follow-up unless the coordinator widens item 153.

## Design

### Milestone 1: Documentation and protocol

Update the requirements before changing the implementation. Keep
`docs/protocol/mokly-base-dependencies.md` below its 250-line cap by replacing
existing installation sentences or moving a large new requirement to the
linked base-preparation page.

- [ ] Record the accepted item 150 process-tree requirement and the accepted
      item 151 token rule in the base dependency and runtime contracts.
- [ ] Record the accepted item 153 Berry TLS fallback and item 158 pnpm
      private-install setting.
- [ ] State that the scripts hint applies to preparation and base-render
      failures, and end the hint with a period.
- [ ] Add the item 157 `--no-changes` behavior to the build and publish
      guides. Keep CLI option tables and protocol text aligned.
- [ ] Add the changed entry points to the compare, CLI, and platform READMEs.
- [ ] State the boundary with item 180: item 151 protects base lifecycle
      scripts only until the sidecar environment decision is implemented.

### Milestone 2: Process ownership for escaped lifecycle scripts

Implement item 150 after its decision. Preserve the existing Windows job
behavior and Unix process-group fast path.

- [ ] Extend the Unix process owner to enumerate descendant PIDs through parent
      links, including descendants that call `setsid`, and signal each owned
      PID during termination and forceful kill. Retain PIDs needed after a
      script reparents during shutdown.
- [ ] Keep enumeration failure conservative. Do not report a stopped tree
      when the platform cannot read its process state.
- [ ] Add deterministic platform tests for a manager script that creates a new
      session and a child that reparents before the second signal. Synchronize
      each case with readiness and stopped-event pipes.
- [ ] Run `cargo test -p mokly-platform` on the supported host and record any
      unhosted macOS or Windows coverage as skipped evidence.

### Milestone 3: Manager policy and one scripts mode

Implement the accepted manager decisions in `mokly-compare` and the CLI
composition boundary.

- [ ] Apply item 151's token-aware scripts policy at the effective mode
      boundary. Emit one warning when a requested scripts opt-in is disabled
      because `MOKLY_TOKEN` or `--token` is present. Keep the token out of the
      child environment and do not change item 180 here.
- [ ] Add Berry TLS file-setting detection before a manager process starts.
      Return a typed tier-three fallback and preserve the existing warning
      subject and lockfile selection.
- [ ] Add pnpm's `--config.confirm-modules-purge=false` to the private install
      command. Do not add `--force`, because it would request extra refetching.
- [ ] Add an install-mode field to `Command`. Pass it only for install
      commands, and make `variables` consume that field instead of inspecting
      argument order. Remove the ineffective configuration mutation while
      preserving the performance branch's Serve wiring.
- [ ] Add unit tests for the token override, Berry fallback, pnpm argument,
      scripts-mode field, and all manager argument and environment pairs.

### Milestone 4: Typed diagnostics and CLI wording

Implement item 152's structural option and the low-severity terminal fixes.

- [ ] Carry a typed scripts-off tier-two marker from base dependency
      preparation through base capture and `Error::Base`.
- [ ] Use one diagnostic helper in Changes-unavailable details, comparison
      failures, Serve errors, and build or publish output. Preserve the
      original error code and base commit in every path.
- [ ] Add the final period to the scripts hint. Keep one recovery action in
      rich output if the accepted item 156 option requires it.
- [ ] Document item 157 in both command guides and keep the grammar tests
      explicit about `--base` versus `--no-changes`.
- [ ] Add Rust regression tests for preparation failures, capture render
      failures, limit failures, Serve presentation, and plain and rich output.

### Milestone 5: Verification and bookkeeping

Verify the complete behavior and record the resolved items in the rebuild plan
after implementation decisions are answered.

- [ ] Run the focused `mokly-platform`, `mokly-compare`, and `mokly-cli` Rust
      tests. Add no Node test in the files owned by workspace 353.
- [ ] Run the early repository check and the complete `cargo xtask check`.
      Run the base-manager smoke command with a private pnpm install and the
      supported lifecycle-script modes.
- [ ] Update `plans/rust-rebuild.md` in one smallest final bookkeeping edit,
      ticking only items 150, 151, 152, 153, 155, 156, 157, and 158. Do not
      tick item 154 or item 180 here.
- [ ] Save all test output and review evidence under
      `.context/base-install-scripts-managers/`.

### Milestone 6: Commit, review, and pull request

Finish the implementation branch under the shared review workflow.

- [ ] Run the deletion audit, commit with a Conventional Commits message, and
      push the branch.
- [ ] Review the complete diff against `origin/main` with the
      `implementation-review` skill. Run its validity and options checks.
      Apply only confirmed auto-fixes, re-review once, and record open findings
      and follow-ups in this plan.
- [ ] Open the pull request after every required milestone is complete. Put
      its link in this status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Run a macOS and Windows process-tree smoke test for escaped manager
      sessions when hosted runners are available.
- [ ] Decide whether the wider npm and pnpm TLS-file probe becomes a separate
      item or a widened implementation of item 153.
- [ ] Recheck the item 151 and item 180 environment rules together before the
      first release that enables either privileged child path.
