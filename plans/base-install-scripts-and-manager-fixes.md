# Base Install Scripts And Manager Fixes

Status: Active. On branch `conductor/rust-rebuild-150-base-install-scripts-and-managers`, no pull request yet. The plan closes when its implementation pull request merges.

Base dependency installs disable lifecycle scripts by default. The
`review.baseInstallScripts` setting and `--base-install-scripts` turn them on.
This plan resolves the open follow-ups of that opt-in from the Rust rebuild:
user items 150, 151, 152, 155, 156, 157, and 158. Item 153 waits for Cal.

- Item 150: Yarn Classic 1.22.22 starts each dependency script in a new Unix
  session, so the process-group signal of a stop misses it.
- Item 151: a script runs as the same user as Mokly, so it can read
  `MOKLY_TOKEN` from the start environment of Mokly or of its launcher.
- Item 152: the scripts hint misses base render failures, because only
  preparation failures carry the scripts-off marker.
- Item 153: a base `.yarnrc.yml` can make Yarn Berry read TLS files outside
  the repository. npm and pnpm read `.npmrc` TLS files in the same way.
- Item 155: the scripts mode has several sources of truth, and the install
  environment guesses it from the arguments.
- Item 156: the hint sentence has no final period.
- Item 157: the scripts flags have no effect with `--no-changes`, and no page
  says so.
- Item 158: pnpm 10 and 11 stop on a modules-directory prompt when a tracked
  `node_modules` state needs recreation.

The change does not port the item 154 end-to-end tests, which workspace 353
owns, and it does not change the sidecar environment of item 180, which
workspace 407 owns. Workspace 353 moves `tests/static_base_*.test.ts` and
`tests/helpers/base_*` to Rust, so this plan edits none of those Node files
and writes its new tests in Rust.

Contract owners:

- [Base Dependencies](../docs/protocol/mokly-base-dependencies.md).
- [Base Source And Dependency Preparation](../docs/protocol/mokly-base-preparation.md).
- [Base Install Processes](../docs/protocol/mokly-base-install-processes.md),
  which Milestone 1 split from the base dependencies page for its line cap.
- [Terminal Errors](../docs/protocol/mokly-terminal-errors.md).
- [Runtime shutdown](../docs/protocol/mokly-runtime.md#shutdown), for the rule
  that no orphan process survives.
- The [build](../docs/guides/cli/build.md) and
  [publish](../docs/guides/cli/publish.md) command guides.
- The [mokly-platform](../crates/mokly-platform/README.md),
  [mokly-compare](../crates/mokly-compare/README.md), and
  [mokly-cli](../crates/mokly-cli/README.md) READMEs.

Files that other work in flight also changes:

- The performance work owns `crates/mokly-cli/src/serve_services.rs`,
  `crates/mokly-cli/src/static_runtime.rs`, and
  `crates/mokly-cli/src/serve_delivery.rs`. This plan does not edit them.
- Item 152 can change the base provider implementations in
  `crates/mokly-cli/src/changes_static.rs` and
  `crates/mokly-cli/src/serve_changes_base.rs`, and the classification in
  `crates/mokly-compare/src/base_render.rs`, which the performance work also
  changed.
- Workspace 407 owns `docs/protocol/mokly-sidecar-modules.md` and the sidecar
  environment. Items 151 and 180 share one token rule, recorded below. This
  plan does not edit that page.

## Decisions

The coordinator answered every decision except item 153 on 2026-10-28, for
Cal. Cal accepts the recorded recommendations unless the coordinator's check
changes them.

- User decision 150 (2026-10-28): C. The Unix process owner enumerates the
  descendants of the owned process through parent links and signals every
  one, also in new sessions. Rejected: A, document the limit, because the
  [runtime shutdown](../docs/protocol/mokly-runtime.md#shutdown) contract
  already says that no orphan process survives; B, keep scripts off for Yarn
  Classic on Unix, because it removes the opt-in for Classic projects.
- User decision 151 (2026-10-28): A. Document the limit under one rule, which
  workspace 407 also states for sidecars:
  - Mokly passes no inherited `MOKLY_` variable to any child process. User
    decision 145 B already does this for package managers.
  - Mokly cannot stop code that runs as the same user from reading the
    environment of Mokly, or of the shell and launcher that started it,
    through `/proc/{pid}/environ`, `ps -E`, or the Windows process block.
  - The docs say that lifecycle scripts do not receive the token, not that
    they cannot read it. They advise the environment variable over
    `--token`, because `/proc/{pid}/cmdline` shows arguments to every user.

  Rejected: B, keep scripts off when a token is present, because
  `validate_publish` in `crates/mokly-cli/src/options.rs` requires a token for
  every publish, so B turns off the opt-in for every publish run. B also closes
  little: the sidecar runs the renderer's dependencies with the inherited
  environment, and the shell and launcher that start Mokly hold the token too.
  C, a separate process space, is not selected. The planning probe found that
  an unprivileged PID namespace here cannot mount its own `/proc`.

- User decision 152 (2026-10-28): C. `Error::Base` carries a typed scripts-off
  field, and one helper presents the hint in every path. Rejected: B, which
  moves the wrap into classification but keeps a separate wrapper variant.
- User item 153 waits for Cal. The coordinator's independent reviewer
  recommends option C for all four managers: a TLS file setting that names a
  path outside the repository sends the base to tier three with a warning,
  through `RepositoryPath::confine` in `crates/mokly-compare/src/manager.rs`,
  and npm-only repositories add `.npmrc` to their input set. That option is a
  stricter check, so Cal must approve it. The other recorded options are A,
  tier three for any Berry TLS file setting, and B, clear the settings.
- User decision 155 (2026-10-28): B. `Command` stores the scripts mode, and
  the install environment reads it. Option A, which removes the redundant
  configuration write `apply_base_install_scripts`, is not selected.
- User decision 156 (2026-10-28): A. The hint ends with a period.
- User decision 157 (2026-10-28): A. The build and publish guides say that
  the scripts flags have no effect with `--no-changes`. Option B, a new
  rejection of the pair, is not selected.
- User decision 158 (2026-10-28): A, for pnpm 10 and 11 only. Their private
  installs pass `--config.confirm-modules-purge=false`. pnpm 12 lists
  `confirmModulesPurge` as a setting of another version and recreates a
  drifted modules directory on a plain install, so pnpm 12 gets no flag.
  Correction to the record: the 145 B allowlist removes `CI` and
  `GITHUB_ACTIONS` from the install environment, so pnpm 10 and 11 also abort
  under CI. The tests prove all three pnpm versions.

## Evidence

Planning evidence is under `.context/base-install-scripts-managers/`:

- `probes/item150_yarn_classic_session.log`: Yarn Classic scripts and their
  children survive group signals in four stop cases.
- `probes/item151_parent_environ.log`: a child without `MOKLY_TOKEN` reads
  the token from `/proc/{pid}/environ` of its parent.
  `probes/item151_pid_namespace.log`: an unprivileged PID namespace here
  still sees the host `/proc` and cannot mount its own.
- `probes/item153_berry_tls_files.log` and
  `probes/item153_npm_pnpm_tls_files.log`: Yarn Berry opens all three TLS
  files, and npm and pnpm open `cafile`, outside the repository.
- `probes/item158_pnpm_prompt/result-with-dep.txt`: pnpm 10.34.7 aborts with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` and succeeds with
  `confirmModulesPurge=false`.
- `records/review-135b-record.md`: the 135 B review findings 42 to 53 with
  their options.

## Milestone 1: Documentation and protocol

The protocol docs and guides state the requirements of the answered items
before the code changes. Item 153 text waits for its decision.

- [x] Item 150: a stop of a base install signals every process that descends
      from the manager through parent links, also in new sessions. State the
      remaining limits beside the requirement.
- [x] Item 151: state the token rule of decision 151 in the base install
      contract, and advise the environment variable over `--token` in the
      publish guide.
- [x] Item 152 and item 156: the scripts hint follows every base failure after
      a scripts-off tier-two install, preparation and render alike, in every
      command. The hint is a complete sentence.
- [x] Item 157: the build and publish guides say that the scripts flags have
      no effect with `--no-changes`.
- [x] Item 158: the pnpm row of the install policy names the
      modules-directory setting for pnpm 10 and 11.
- [x] Keep each protocol page under its 250-line cap, and validate the
      changed Markdown.
- Commit `15f91820`. The base dependencies page passed its cap, so the
  environment, executable, bound, and stop rules moved to the new base install
  processes page, which the protocol index lists.

## Milestone 2: Process ownership for escaped scripts

Item 150. The Unix owner of a process tree finds and signals descendants in
new sessions. Windows keeps its kill-on-close job.

Stopped on 2026-10-28. The Codex delegate hit its usage limit, which resets
on 2026-11-04, before it finished or committed. Under the coordinator's rule,
this part waits. Its uncommitted work is in the local worktree branch
`wt/base-install-150-process-tree` and in
`.context/base-install-scripts-managers/stopped/item150-c1-partial.patch`.

- [ ] Add failing tests first: a descendant in a new session survives a
      group kill and a terminate-then-kill on the current code.
- [ ] Enumerate the descendants through parent links on Linux and macOS,
      stop them before the signal, and signal each one. Keep the identities
      found by a first signal for the second signal.
- [ ] Keep the cost of a stop of a reaped or childless tree to a few system
      calls, because the Git runner kills its group after every command.
- [ ] Add a `mokly-compare` integration test with a manager that starts a
      detached child, as Yarn Classic does, for the time limit and for
      cancellation.
- [ ] Check that the macOS and Windows code compiles.

## Milestone 3: One scripts mode and the pnpm purge setting

Items 155 and 158 in `mokly-compare`.

- [x] Add failing tests first: an install whose arguments do not start with
      `install` keeps its scripts mode, and pnpm 10 and 11 abort on a tracked
      modules state that needs recreation.
- [x] Store the scripts mode on `Command`. Install commands carry the
      effective mode. Version and Node probes carry scripts off.
      `manager_command::variables` reads the field.
- [x] Pass `--config.confirm-modules-purge=false` to pnpm 10 and 11 private
      installs only.
- [x] Prove pnpm 10.34.7, 11.20.0, and 12.14.0 in a Rust integration test with
      the pinned development CLIs, with and without `CI=true` in the parent
      environment.
- [x] Reword the code comments that say a lifecycle script cannot read an
      inherited secret. A script does not receive it.
- Commit `723ca0b6`. The Codex delegate stopped on its usage limit before
  it committed. The orchestrator re-ran the crate tests, clippy, fmt, and the
  file-length lint, ran the pnpm version matrix, and committed the work
  unchanged. Matrix: `.context/base-install-scripts-managers/verify/`.

## Milestone 4: Typed scripts-off diagnostics

Items 152 and 156 in `mokly-compare` and `mokly-cli`.

- [ ] Add failing tests first: a base render failure in capture after a
      scripts-off tier-two install shows no hint on the current code.
- [x] Replace `Error::BaseInstallScripts` with a typed scripts-off field on
      `Error::Base`. Classification sets it for preparation, capture, and
      every later failure that it attributes to the base.
- [x] Present the hint through one helper in build and publish details, the
      limit path, fatal comparison failures, and Serve errors and reasons.
      Keep the original code and base commit.
- [x] End the hint with a period, and join sentences without a double period.
- Merge `ba8e4dde` of commit `7fce66c4`. The failing-first run failed only on
  the missing period. The capture-path test needs the new provider types, so
  it never ran on the unchanged code. Evidence:
  `.context/base-install-scripts-managers/item152-156/`.
- Open change request to the delegate, blocked by the Codex usage limit:
  replace the five `map_err` calls in `changes_base.rs`, prefix the
  `BasePreparationError` message, restore the `CatalogueError` import in
  `serve_changes_base.rs`, move the preparation types out of the 282-line
  `base_render.rs`, and use the imported `Error` in its test.

## Milestone 5: Item 153 TLS file settings

This milestone waits for Cal's decision on item 153 and on the npm and pnpm
scope. Do not start it before the answer.

- [ ] Record Cal's decision on item 153 and its scope.
- [ ] Implement the selected option with failing tests first, and update the
      protocol docs.

## Milestone 6: Crate READMEs and doc alignment

- [x] Update the platform, compare, and CLI READMEs for the changed entry
      points and behaviour.
- [x] Check the protocol docs and guides against the final code.
- Commits `646ba07a` and `2884bb79`. The compare and CLI READMEs name the
  landed entry points. The platform README waits for item 150, so the base
  install processes page carries a status line until then.

## Milestone 7: Verification, commit, review, and pull request

- [ ] Run the targeted Rust tests of `mokly-platform`, `mokly-compare`, and
      `mokly-cli`. Add no Node test in the files that workspace 353 owns.
- [ ] Merge `origin/main` with the `git-merge` skill, then run the complete
      gate `cargo xtask check` once on the final commit.
- [ ] Tick user items 150, 151, 152, 155, 156, 157, and 158 in
      `plans/rust-rebuild.md` with the smallest edit. Do not tick 153, 154,
      or 180.
  - Items 151, 152, 155, 156, 157, and 158 are ticked. Item 150 waits for
    Milestone 2.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] The coordinator opens the pull request when every other milestone TODO
      is ticked. Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Run a macOS process-tree smoke test for escaped manager sessions on a
      hosted runner.
