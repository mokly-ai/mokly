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
exists once on `PATH`, and the release `mokly-build-v6`. It does not change
the runner, the API, or main-preview's app-config. Cal switches main-preview
to v6 after the merge.

The spike evidence is in `.context/spike-debian-base/report.md`. E2B
provisions systemd, sudo, openssh-server, and its other agent packages on
every base, so plain Debian needs nothing from `e2bdev/base`. The bookworm,
bookworm with `build-essential`, and trixie candidates passed the live probe
and the smoke build. Only trixie and v5 passed the comparison build.

Contract owners:

- [Cloud build runner](../docs/protocol/cloud/cloud-build-runner.md#template).
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

- [ ] `docs/protocol/cloud/cloud-build-runner.md`, section "Template": a
      Debian base pinned by digest, Debian's Git, a C compiler, a C++
      compiler, `make`, and one copy of each key tool on `PATH`.
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

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
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

## Post-merge follow-up (non-blocking)

- [ ] Cal switches main-preview's build template to the v6 build reference
      and confirms one comparison build with `changesStatus: "ready"`.
