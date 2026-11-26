# Build template on a plain Debian base

Status: Active. On branch `calummoore/builds-spike-a-plain-debian-base-for-the-aa76`,
no pull request yet. The pull request that completes the work deletes this
plan, as the `plans` skill says.

The cloud build template starts from `e2bdev/base`. That image brings its own
Node, npm, Python, Yarn, `gh`, and compiler beside the tools that the
Dockerfile installs. In release v2 the old npm mixed with the new npm, and
every build failed at `npm ci`. Release v5 adds Git 2.56.1, built from source,
because Mokly's comparison build needs Git 2.43 or newer and Debian 12 has
2.39.5. This change moves the template to `debian:trixie-slim`, pinned by
digest. Trixie's own Git 2.47.3 meets the floor, so the Git build from source
goes. The change adds `build-essential`, a probe check that each key tool
exists once on `PATH`, and the release `mokly-build-v7`. Release
`mokly-build-v6` on `main` is a different build on `e2bdev/base` (decision 6). It does not change
the runner, the API, or main-preview's app-config. Cal switches main-preview
from v6 to v7 after the merge.

The spike evidence is in `.context/spike-debian-base/report.md`. E2B
provisions systemd, sudo, openssh-server, and its other agent packages on
every base, so plain Debian needs nothing from `e2bdev/base`. The bookworm,
bookworm with `build-essential`, and trixie candidates passed the live probe
and the smoke build. Only trixie and v5 passed the comparison build.

Contract owners:

- [Cloud build template](../docs/protocol/cloud/cloud-build-template.md).
- [Repository layout](../docs/protocol/cloud/repository-layout.md#build-toolchain-checks).
- The runbook [Cloud Build Template](../docs/ops/build-template.md).

Replaced ways:

- `e2bdev/base` pinned by tag and digest → `debian:<tag>@sha256:<64 hex>`.
  Consumers: `infra/e2b/build/e2b.Dockerfile`, the pin check in
  `xtask/src/policy/build_pins.rs` and its tests, `pinned_base_images` in
  `infra/tests/test_build_template.py`, both protocol docs, and the runbook.
  Moved in Milestones 1, 2, and 4. Deleted in Milestone 2.
- Git built from kernel.org source → Debian's Git package. Consumers: the
  Dockerfile and the runbook. Moved in Milestones 2 and 4. Deleted in
  Milestone 2.

## Decisions

Cal answered the spike items on 2026-11-26.

1. Base and Git source: A. Use `debian:trixie-slim` by digest with Debian's
   Git, change the pin rule to `debian:<tag>@sha256:<64 hex>`, and release
   `mokly-build-v6`. Rejected: bookworm with Git from source, because each Git
   security release then needs a new checksum and release, and Debian 12 has
   LTS fixes only. Rejected: keep `e2bdev/base`, because a new digest can
   bring a second copy of a tool again.
2. Compiler: B. Install `build-essential`, and add a C compiler, a C++
   compiler, and `make` to the template requirements and to the probe.
   Rejected: no compiler, because consumer installs that build a native addon
   from source pass on v3 today and would fail.
3. Security refresh: A. Release only on change, as today. No refresh rule.
   Rejected: a monthly refresh and Dependabot digest updates.
4. Second copies: B. The probe requires exactly one real file each for
   `node`, `npm`, `npx`, `corepack`, `python3`, and `git` on `PATH`. Rejected:
   no check, and an allow-list of files in `/usr/local`.
5. Runbook: A. Add the libpq development files to the release prerequisites,
   because the live probe does not link without them.
6. Release name: Cal decided on 2026-11-26 that the Debian release is
   `mokly-build-v7`. PR #571 had already released `mokly-build-v6` on
   `e2bdev/base` with Git 2.56.1 from source, and main-preview runs it. That
   v6 stays the v6 record. The Debian build
   `mm5vcm4xv7inkey7ad9p:b63ce806-b4a9-4567-a406-89300f259d8b` of Milestone 3
   was built under the reused name v6. It shares v6's template ID, it is not a
   release, and the template must not be deleted, because that deletes
   main-preview's live build.

7. Template contract page: B (answer to the runner page item). Move the
   template contract to its own protocol page under `docs/protocol/cloud/`,
   and keep a short linking "Template" section in `cloud-build-runner.md`.
   Rejected: rewrapping six paragraphs to stay under the 250-line cap.
8. Native build proof: D. The probe compiles and links a small C and C++
   program offline through `make`'s default rules, with the `cc`, `g++`,
   `ar`, and `ld` that node-gyp uses. Rejected: a forced addon build, which
   needs the network and passes the 10-second limit.
9. Rollback item: B. Rescope it to "a failing release has no verified
   rollback target", with its options C and F as the main options.
10. Build helpers: B. Add `pkgconf` and `libtool`, and release
    `mokly-build-v8` before the switch. v7 is superseded by v8.
11. Stale follow-ups: B. Name the selection rule "the newest release whose
    record passes the current probe", add a control run where needed, and
    require the full build reference in every proof record.
12. Debian fixes: C. The release script passes `skipCache: true`, because
    the E2B step cache is shared across template names.

Design calls, my calls on 2026-11-26:

- The `FROM` tag is the dated tag, such as `trixie-20261123-slim`, so that the
  tag names the one image that the digest fixes.
- The Dockerfile runs `apt-get upgrade` before its install, because E2B caches
  its provisioning layer per base image.
- The Dockerfile keeps every required tool in its own `apt-get install`, also
  a tool that E2B also installs, because E2B's list does not hold `python3`
  and can change.
- The pin rule accepts only `debian` images, so `e2bdev/base` fails the check.
- The one-copy check compares real paths, because `/bin` links to `/usr/bin`.
- No new plan decision waits for the options check: Cal answered each item,
  and the spike brainstorm widened and narrowed its options.

## Milestone 1: Documentation and protocol

Depends on: none. Starts after the v5 pull request merges into `main` and
`main` merges into this branch.

- [x] `docs/protocol/cloud/cloud-build-runner.md`, section "Template": a
      Debian base pinned by digest, Debian's Git, a C compiler, a C++
      compiler, `make`, and one copy of each key tool on `PATH`. Done by
      Milestone 8, which moves the contract to `cloud-build-template.md`.
- [x] `docs/protocol/cloud/repository-layout.md`, section "Build Toolchain
      Checks": the pin form `debian:<tag>@sha256:<64 lowercase hex>`.

## Milestone 2: Template definition, pin rule, and probe

Depends on: none. Starts with Milestone 1.

- [x] Resolve the `debian:trixie-slim` digest and its dated tag on Docker Hub.
      Record the date and the source. Evidence:
      `.context/build-template-debian-base/digest-resolved-at.txt`.
- [x] `infra/e2b/build/e2b.Dockerfile`: the trixie base by dated tag and
      digest, `apt-get upgrade`, `build-essential`, no removal of an old
      Node, and no Git build from source.
- [x] `infra/e2b/build/e2b.toml`: `template_name = "mokly-build-v6"`.
- [x] Pin rule in `xtask/src/policy/build_pins.rs` and
      `infra/tests/test_build_template.py`, with tests that reject
      `e2bdev/base`.
- [x] Probe: `cc`, `c++`, and `make`, and one real file for each key tool,
      with regression tests that fail before the change. Evidence:
      `.context/build-template-debian-base/m2-red.txt` and
      `m2-repository-final.txt`.

## Milestone 3: Release `mokly-build-v6`

Depends on: 2.

- [x] Build `mokly-build-v6` from the final Dockerfile with the release script.
- [x] Live probe, smoke build, comparison build, and a forced native addon
      build from source. Evidence in `.context/build-template-debian-base/`.

## Milestone 4: Runbook and records

Depends on: 3.

- [x] `docs/ops/build-template.md`: the base pin source, the libpq
      prerequisite, no old-Node or Git-source text, and the v6 release record.
- [x] `plans/follow-ups/cloud-builds-never-ran-live.md`: name the live release.

## Milestone 5: Verification, commit, and review

Depends on: 2, 3, and 4

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
      Evidence: `.context/build-template-debian-base/gate-full-3.log` and
      `suite-*.log`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report. Findings file:
      `.context/reviews/calummoore/builds-spike-a-plain-debian-base-for-the-aa76/findings.md`.

## Milestone 6: Release `mokly-build-v7` after the v6 merge

Depends on: 5. Starts after `main` with PR #571 merges into this branch.

- [x] Merge `origin/main` with PR #571. `main`'s v6 stays the v6 record, the
      Debian Dockerfile and probe stay, and the Debian build `b63ce806`
      becomes a candidate entry.
- [x] `infra/e2b/build/e2b.toml`: `template_name = "mokly-build-v7"`.
- [x] Resolve the trixie digest again, and confirm that no E2B template has
      the name `mokly-build-v7`. Evidence:
      `.context/build-template-debian-base/digest-resolved-v7.txt`.
- [x] Build `mokly-build-v7` from the final Dockerfile with the release
      script. Run the live probe, the smoke build, the comparison build, a
      forced native addon build, and `git grep -P`. Evidence:
      `.context/build-template-debian-base/v7-build.log`, `v7-probe.log`, and
      `v7-release-checks.json`.
- [x] `docs/ops/build-template.md`: the v7 release record.
- [x] Reconcile the follow-up items that PR #571 added or kept with this
      change.
- [x] Run the gate checks again, review the merge, and push. Evidence:
      `.context/build-template-debian-base/gate-full-4.log` and round 3 of the
      findings file.

## Milestone 8: Template contract page and follow-ups

Depends on: 6.

- [x] New protocol page for the template contract, and a short linking
      "Template" section in `docs/protocol/cloud/cloud-build-runner.md`.
- [x] Rescope and rename the rollback follow-up item.
- [x] Name the selection rule and the full build reference in the stale
      follow-up items.

## Milestone 9: Probe build proof, build helpers, and no step cache

Depends on: 6. Runs with Milestone 8.

- [x] Dockerfile: add `pkgconf` and `libtool`.
- [x] Probe: compile and link a C and a C++ program through `make`'s default
      rules, and require `pkg-config` and `libtool`, with a regression for
      each missing tool that fails first.
- [x] `infra/e2b/build/build-template.mjs` passes `skipCache: true`, with a
      regression in `infra/tests/test_build_template_release.py`.
- [x] `infra/e2b/build/e2b.toml`: `template_name = "mokly-build-v8"`.

## Milestone 10: Release `mokly-build-v8`

Depends on: 8 and 9.

- [x] Resolve the trixie digest again, and confirm that the name is free.
- [x] Build v8 without the step cache, run the live probe, the smoke build,
      the comparison build, a forced native addon build, `git grep -P`,
      `pkg-config --version`, and `libtool --version`.
- [x] Runbook: the v8 record, v7 superseded, and the cache paragraph.
- [ ] Run the gate, review the new changes, and push.

## Milestone 7: Plan deletion and pull request

Depends on: every other milestone

- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Cal switches main-preview's build template from v6 to the v8 build reference
      and confirms one comparison build with `changesStatus: "ready"`.
