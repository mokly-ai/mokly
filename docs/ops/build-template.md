# Cloud Build Template

Provision builds for `main-preview` or `production`. Each environment needs
an E2B team key, a verified released template and an exclusive deployment ID.
PR previews always keep builds disabled. The contract is
[Cloud build runner](../protocol/cloud/cloud-build-runner.md).

## Release Prerequisites

Use an authorized operator shell. Install the repository's Node and npm pins.
Also install the libpq development files, such as Debian's `libpq-dev`,
because the live probe's `cargo test` links libpq. Without them, the probe's
build fails with `unable to find library -lpq`.
This procedure uses the `e2b@2.64.0` SDK through
`infra/e2b/build/build-template.mjs`. E2B builds the Dockerfile remotely, so
the shell needs no Docker. The SDK build needs only the team key. The script
sends that key only to `https://api.e2b.dev`, the API base of the runtime. It
ignores the SDK's `E2B_API_URL`, `E2B_SANDBOX_URL`, `E2B_DOMAIN` and
`E2B_DEBUG` settings, so a shell set up for another E2B host cannot redirect
the key. The
`@e2b/cli` Dockerfile build uses E2B's deprecated build system and also needs
a personal access token, so this procedure does not use it.
Keep the team key in a mode-0600 file outside the checkout, such as
`/secure/e2b-api-key`. Never put it in build arguments, a Dockerfile, TOML,
Helm values, logs or a release report. Disable shell tracing.

`infra/e2b/build/e2b.toml` is the release definition. It declares
`mokly-build-v<N>`, 2 vCPU and 4096 MiB. It has no provider ID. The first build
writes an operator-local `e2b.toml` with the real ID. Do not use the checked-in
definition as a provider configuration.

The Dockerfile uses the [runner's base-image pin](../protocol/cloud/cloud-build-runner.md#template),
`debian:trixie-20261123-slim@sha256:8aa5a7bf5a1955bddbe7d74fcdd0b91ab30e74362a8b73af672b0481b35b44a0`.
The digest was resolved on 2026-11-26 from the tag's
[Docker Hub record](https://hub.docker.com/v2/repositories/library/debian/tags/trixie-20261123-slim).
The registry confirms the digest, an OCI index that includes Linux amd64 and
arm64 images. The dated tag names the one image that the digest fixes.

The Dockerfile upgrades the installed Debian packages. Then it installs
`build-essential`, CA certificates, coreutils, curl, Git, Python 3 and
`xz-utils` from Debian. It installs the exact `.nvmrc` Node tarball with its
checked-in SHA-256 from Node's release `SHASUMS256.txt`. The tarball supplies
npm and corepack, and the Dockerfile enables corepack. The base has no Node,
npm, Python or Git of its own, so the image holds one copy of each. E2B's
build adds systemd, sudo, openssh-server, chrony and its other agent packages
to any Debian image, so the base needs nothing else.

The image must keep glibc 2.28 or newer, because the pinned CLI's native
binary has no musl build and no JavaScript fallback.
The image must also keep Git 2.43 or newer. The CLI reads a comparison base
with `git cat-file --batch --filters -Z`, which Git 2.42 added, and 2.43.0 is
the oldest Git with a recorded working comparison. Debian trixie's Git 2.47.3
meets that floor, and Debian's security updates cover it. The image must keep
a C compiler, a C++ compiler and `make`, so that a dependency can compile a
native addon during `npm ci`.

Workload `user` owns `/workspace`. Its `HOME` is `/home/user`.
The image sets no `PATH`, because E2B sets the process `PATH` itself.
The build context admits only the Dockerfile. No cloud or checkout credential
is baked into the image.

Before a Node update, change `.nvmrc` and the Dockerfile version and checksum
together. Run `cargo xtask toolchain-pins` and the local template regressions.
An E2B base or tool change also requires a new template release and assertion.
The [build toolchain checks](../protocol/cloud/repository-layout.md#build-toolchain-checks)
reject an unpinned base before release.

## Build And Publish A Candidate

For a new release, increment `template_name` in the checked-in definition.
Use a new candidate directory. A build of an existing name keeps its
template ID, and a bare template ID starts the newest ready build of that
name. So a release is always deployed, verified and rolled back by its build
reference, `TEMPLATE_ID:BUILD_ID`, which starts only the build that passed
verification.

Run from the repository root:

```sh
set -eu
umask 077
TEMPLATE_RELEASE=$(sed -n 's/^template_name = "\(.*\)"$/\1/p' infra/e2b/build/e2b.toml)
TEMPLATE_DIRECTORY=".context/e2b/$TEMPLATE_RELEASE"
test ! -e "$TEMPLATE_DIRECTORY/e2b.toml"
install -d -m 0700 "$TEMPLATE_DIRECTORY"
cp infra/e2b/build/e2b.Dockerfile "$TEMPLATE_DIRECTORY/"
npm install --prefix "$TEMPLATE_DIRECTORY/sdk" --no-save --ignore-scripts e2b@2.64.0
export E2B_API_KEY="$(cat /secure/e2b-api-key)"
node infra/e2b/build/build-template.mjs "$TEMPLATE_DIRECTORY/sdk" \
  "$TEMPLATE_DIRECTORY" "$TEMPLATE_RELEASE" \
  "$(sed -n 's/^cpu_count = //p' infra/e2b/build/e2b.toml)" \
  "$(sed -n 's/^memory_mb = //p' infra/e2b/build/e2b.toml)"
unset E2B_API_KEY
```

The command must exit zero and report the candidate ready with its build
reference. Read `build_reference` from the generated
`$TEMPLATE_DIRECTORY/e2b.toml`. Record the release name, build reference,
template ID, build ID, E2B team, source commit, Node version, checksum, CPU,
memory and UTC time in the deployment change. Keep the generated provider
configuration under `.context/`; put only the verified build reference in
environment app-config.
Include the base-image digest in that release record.

## Verify The Streaming Boundary

Verify a fresh candidate before enabling it. The API integration probe uses
the same pinned adapter capabilities and public-egress build profile as
the runner. Its deployment ID is `mokly-build-template-probe`, separate from
all environment build inventories. It creates a one-shot sandbox, writes
`infra/e2b/tests/assert_build_template.py` below `/workspace` and calls
`stream_process` as `user`. Its argv is:

```text
python3 /workspace/assert_build_template.py --node-version <.nvmrc release>
```

The process has exactly one added environment entry:
`MKC_TEMPLATE_PROBE=stream-process-added-env`. The caller does not supply
`PATH` or `HOME`. The script requires the added entry, `HOME=/home/user` and
each tool on the process `PATH`. It does not compare the exact `PATH` value.
E2B's process service supplies `HOME` and `PATH` itself, so a pass does not
prove that a value set only by the template reaches the process. It also checks the tools,
`/bin/sh`, user identity, `/workspace` ownership and writes, known credential
environment names and credential files, and absence of cloud secret mounts.
It also requires glibc 2.28 or newer. It runs an offline `npm ci` of an empty
project, so an npm install that mixes files of two releases fails the probe.
It requires that the `git` on the process `PATH` reports 2.43 or newer and
accepts `git cat-file --batch --filters -Z` on empty input in a new
repository. It reads no file and runs no comparison, so a pass does not prove
that a comparison works. It requires `cc`, `c++` and `make`. It requires that
`node`, `npm`, `npx`, `corepack`, `python3` and `git` each resolve to one real
file on `PATH`.
The E2B team key stays in the operator process.

Choose the build reference to probe, and set `CANDIDATE_REFERENCE` to it:

- A new candidate reads the `build_reference` of its generated
  `$TEMPLATE_DIRECTORY/e2b.toml`:

  ```sh
  CANDIDATE_REFERENCE=$(sed -n 's/^build_reference = "\(.*\)"$/\1/p' "$TEMPLATE_DIRECTORY/e2b.toml")
  ```

- A recheck of a release in use takes the environment's `builds.template`
  value and changes no configuration.
- A production promotion takes the reference that passed the main-preview proof.
- A published release that the target environment does not run yet takes the
  build reference from its record in [Live Evidence](#live-evidence).
- A rollback also takes the build reference from its record. It uses only a
  previous reference whose release meets the current
  [template contract](../protocol/cloud/cloud-build-runner.md#template). When
  no recorded release meets it, disable builds as the last section says,
  then publish and verify a new release.

Then probe that reference:

```sh
set -eu
test -n "$CANDIDATE_REFERENCE"
export MKC_E2B_API_KEY="$(cat /secure/e2b-api-key)"
export MKC_E2B_BUILD_TEMPLATE="$CANDIDATE_REFERENCE"
cargo test -p mkc-api --features live-build-template \
  --test build_template_tests live_template -- --nocapture
unset MKC_E2B_API_KEY MKC_E2B_BUILD_TEMPLATE
```

Require `PASS live build template: assertion completed and candidate destroyed`
and exit code zero. The probe destroys the sandbox after an assertion, write
or stream failure, and recovers an ambiguous create without replaying it.
Each operation is bounded by 120 seconds. The sandbox's 360-second one-shot
lifetime is the backstop after interruption or failed cleanup. A failed probe
is not a release. Fix the candidate and publish a new version.

Record the probe result and UTC time with the candidate record. Local checks
use unimock and Python regressions. They compile the opt-in probe but do not
contact E2B or prove that a candidate starts there.

## Provision And Enable One Environment

Foundation declares the E2B key IDs and their reader grants, and the next
foundation apply creates them. It creates exactly one protected
`mkc-<environment>-e2b-api-key` ID and one API Google-account reader grant in
each stable environment. Secret values remain outside Terraform. If either
resource already exists, import it before the next foundation apply. `main`
already declares both resources, so today that apply is the
[foundation bootstrap](./foundation.md#foundation-bootstrap). For
main-preview:

```sh
terraform -chdir=infra/terraform/foundation import \
  'module.secrets["main-preview"].google_secret_manager_secret.this["e2b-api-key"]' \
  projects/mokly-508518/secrets/mkc-main-preview-e2b-api-key
terraform -chdir=infra/terraform/foundation import \
  'module.secrets["main-preview"].google_secret_manager_secret_iam_member.workload["api/e2b-api-key"]' \
  'projects/mokly-508518/secrets/mkc-main-preview-e2b-api-key roles/secretmanager.secretAccessor serviceAccount:mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com'
```

Import only resources that already exist. Review the foundation plan after
import. Do not import secret versions. Set `ENVIRONMENT` to `main-preview` or
`production`, matching the target of the reviewed plan. Add the operator key
as a version:

```sh
gcloud secrets versions add "mkc-$ENVIRONMENT-e2b-api-key" \
  --project=mokly-508518 --data-file=/secure/e2b-api-key
```

Update `MKC_MAIN_PREVIEW_APP_CONFIG` or `MKC_PRODUCTION_APP_CONFIG` beside its
complete `github` object. Use the verified build reference, not a bare
template ID or a mutable template alias:

```json
{
  "builds": {
    "enabled": true,
    "template": "RELEASED_TEMPLATE_ID:RELEASED_BUILD_ID",
    "deploymentId": "main-preview-builds",
    "perProcess": 4,
    "deniedDestinations": ["203.0.113.0/24"]
  }
}
```

This example shows only the builds member. Keep the existing complete GitHub
member. Choose a different deployment ID for production. Add only actual
deployment addresses to `deniedDestinations`; omit the example network.
An omitted or empty list adds no deployment denies. The runner adds the fixed
deny ranges. Keep the public API upload addresses reachable.

The renderer and chart reject partial groups, unsupported fields, builds
without GitHub and PR enablement. Keep `scaling.minReplicas` at least two.
Tune retention through the checked-in `maintenance.buildRetentionSeconds`
chart value, default thirty days. Only prune receives that setting.

The test repository must use Mokly 0.18.0 or later with a `mokly.config.json`
configuration, and the project's config path must name that file.
Its install must keep optional dependencies, which hold the
CLI's native binary. It publishes from a clean checkout. Ignore
install files and every build output directory. A dirty checkout fails before
upload, as the [runner contract](../protocol/cloud/cloud-build-runner.md#steps)
defines.

Before enabling a release, run `cargo xtask mokly-fixtures --check` to verify
the [mapped CLI codes](../protocol/cloud/mokly-fixture-regeneration.md#cli-failure-codes)
against its pinned release. Use the
[runner limits](../protocol/cloud/cloud-build-runner.md#budgets) to distinguish a
stream failure from output dropped by log retention. Follow the pinned
Mokly CI guide's **Forks** rule: review a fork's screens locally and give the
pull request no upload credentials.

Run the normal reviewed rollout and [deployment smoke](./deploy.md).
Wait for at least two ready API replicas and confirm the API HPA minimum is
two or greater. Confirm the API-only CSI class names the environment key.
Check configuration names without reading key values. App, catalogue,
migration and maintenance must have no E2B key mount.

The public API health route checks process, revision, database and migrations.
It does not check E2B, the template or worker progress. Build availability
means configuration and repository access are present, not provider readiness.
On first enablement, request a build against a real installed test repository.
Require a published build, its ready publication on the catalogue origin,
a completed GitHub check and removal of the attempt sandbox. Record the
revision, build and publication IDs, check result, timings and UTC time.
Also prove a same-repository pull request build and Re-run. Time one pull
request build whose base lockfile differs from its head, because the CLI then
installs the base's dependencies inside the publish step's deadline.
This credentialed
proof is separate from the repository's local checks.

## Rotate, Roll Back And Disable

For a template rotation, publish and verify `mokly-build-v<N+1>`, change only
the reviewed build reference, and roll the API. Keep the previous release ready
for rollback when it meets the current template contract. A contract change,
such as the Git floor, can retire it. Do not change the environment deployment ID during rotation;
the new worker must reconcile sandboxes made by the previous worker.

For key rotation, create a replacement key in the same E2B team. Verify the
candidate with it. Add a Secret Manager version, then explicitly restart the
API even when Helm values and image are unchanged. Follow
[secret restart commands](./secrets.md). Keep the old key enabled until all
old API pods have stopped, in-flight attempts have finished or been recovered,
and a real build and inventory cleanup succeed with the replacement. Then
disable the old secret version and delete the old E2B key. Never change a
template or add a key version through Terraform.

A provider failure retries under the build lifecycle. It does not make API
health fail. Inspect safe worker diagnostics, build outcomes, check dead
letters and inventory cleanup before deciding that a rollout is ready.
If verification fails, restore the previous key version, or a previous build
reference chosen as "Verify The Streaming Boundary" says, and restart the API.
When no build reference qualifies, disable builds. Keep keys needed by old pods until recovery completes.

Lease loss follows the
[live-lease renewal rule](../protocol/cloud/cloud-builds.md#claims-leases-and-retries).
Concurrent completion and attempt endings
follow the [persistence lock order](../protocol/cloud/persistence-publication-storage.md#build-and-publication-lock-order).

To disable builds, stop new build requests and cancel or drain active attempts
first. Set app-config `builds` to exactly `{ "enabled": false }` and roll the
API. The chart removes all API build settings and the E2B mount. The API
schedules nothing and reports builds unavailable. Prune keeps its retention
setting. Disabling does not cancel existing database rows; without a worker,
queued rows and expired leases wait until builds are enabled again. One-shot
lifetimes bound remaining sandboxes. CI publication remains available.

## Live Evidence

### Template Releases

- `mokly-build-v1`, template ID `agmlidt65d7s6oo23rkb`, E2B team `firna`,
  built 2026-11-06T11:01:33Z with the deprecated `@e2b/cli@2.7.0` build
  system. It failed the probe on 2026-11-24 on the exact `PATH` check, which
  the contract no longer has: the process had `/usr/local/sbin` before
  `/usr/local/bin`, unlike the template's `ENV PATH`. The cause is unknown. It
  is not a release.
- `mokly-build-v2`, build reference
  `f1x5cj2fgwv20p42qxnn:2f7ad3b2-ffae-4e31-a4e9-33f3d2d26374` (template ID
  `f1x5cj2fgwv20p42qxnn`, build ID `2f7ad3b2-ffae-4e31-a4e9-33f3d2d26374`),
  E2B team `firna`. It was built
  2026-11-24T13:44:01Z with `e2b@2.64.0` from the Dockerfile of the change that
  removed `ENV PATH`, on base commit `c0328d917`. Node 24.21.0, checksum
  `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`,
  2 vCPU, 4096 MiB, base digest
  `sha256:4a369f01a820fe5e65f53c2c5727a78899daf86f0541b721097f289559c8b73f`.
  The probe printed
  `PASS live build template: assertion completed and candidate destroyed` on
  2026-11-24T13:46Z with the bare template ID, and again on 2026-11-25 with
  the build reference through the adapter pinned at `5d856db`. It is not a
  release, because its npm is broken. The Dockerfile unpacked the Node tarball
  over `/usr/local` of `e2bdev/base`, which already held an older Node and npm.
  So `/usr/local/lib/node_modules/npm/lib` held files of npm 11 and of the
  older npm. `npm --version` printed 11.19.0, but `npm config list` failed,
  and `npm ci` failed with
  `npm error Class extends value undefined is not a constructor or null`. The
  probe of that time checked npm only with `npm --version`, which passes on
  such a mixed install, so it passed. Do not deploy it or roll back to it.
- `mokly-build-v3`, build reference
  `1zj5lunxulyowh6ewmy3:9dffde05-0e34-4afd-91f3-ac771fd52705` (template ID
  `1zj5lunxulyowh6ewmy3`, build ID `9dffde05-0e34-4afd-91f3-ac771fd52705`),
  E2B team `firna`. It was built 2026-11-26T00:40:38Z with `e2b@2.64.0`
  through `infra/e2b/build/build-template.mjs`. Its Dockerfile is the one at
  `e1b372b7d`, which matches `main`, plus the removal of the base image's
  Node, npm and corepack files before the Node tarball is unpacked. Node
  24.21.0, checksum
  `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`,
  2 vCPU, 4096 MiB, base digest
  `sha256:4a369f01a820fe5e65f53c2c5727a78899daf86f0541b721097f289559c8b73f`.
  In a sandbox of it, npm's `lib` held only npm 11 files, `npm config list`
  worked, `npm ci` of a lockfile with `@mokly/mokly` 0.21.0 succeeded, and
  `mokly build --strict --no-changes` built the catalogue. The probe printed
  `PASS live build template: assertion completed and candidate destroyed` on
  2026-11-26 with the build reference. That run came before the probe's
  `npm ci` check. It is a working release for builds without a comparison,
  but it cannot compare. Its Git is Debian bookworm's 2.39.5, and
  `git cat-file --batch --filters -Z` exits 129 there with unknown option
  `-Z`. In a sandbox of it, the runner's checkout and
  `mokly build --config mokly.config.json --base origin/main` of a pull
  request printed `base <sha>: [mokly/config-invalid] mokly.config.json: unknown`,
  and the published index had `changesStatus: "unavailable"`. The probe's Git
  check rejects this Git, and no probe with that check has run against v3. It
  does not meet the current template contract, so do not roll back to it.
- `mokly-build-v4` was a candidate that installed Git from bookworm-backports.
  It still had Git 2.39.5, so it was deleted. It is not a release.
- `mokly-build-v5`, build reference
  `tpjwc7qiz8bp7bvnpzp7:433b3d4d-1e81-4d54-8963-d62eceb3ecc8` (template ID
  `tpjwc7qiz8bp7bvnpzp7`, build ID `433b3d4d-1e81-4d54-8963-d62eceb3ecc8`),
  E2B team `firna`. It was built 2026-11-26T10:00:53Z with `e2b@2.64.0`
  through `infra/e2b/build/build-template.mjs`. Its Dockerfile is the one at
  `1578b776f` plus the Git source build: Git 2.56.1, checksum
  `f0b0bf89264b9bd2e1c640363e7529643989da76281600473c50745cd34a607f`. Node
  24.21.0, checksum
  `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`,
  2 vCPU, 4096 MiB, base digest
  `sha256:4a369f01a820fe5e65f53c2c5727a78899daf86f0541b721097f289559c8b73f`.
  In a sandbox of it, `git` was `/usr/local/bin/git` 2.56.1, an HTTPS
  `git ls-remote` worked, `git cat-file --batch --filters -Z` exited 0,
  `npm ci` worked, and the `--base origin/main` build of the same pull request
  gave `changesStatus: "ready"`. A container check of the pinned base on
  2026-11-26 found that the Dockerfile's purge leaves no `gcc`, `g++`, `make`
  or `ld`, which v3 still had. The live probe from `main`, with its `npm ci`
  check, passed on 2026-11-26 with the build reference. That run came before
  the probe's Git check, and its UTC time and assertion commit are not
  recorded. The live probe from commit `0ad58e724` failed against v5 on
  2026-11-26. Its script, run by hand on v5, printed
  `FAIL build template: python3 has multiple copies on PATH`. Beside Debian's
  Python and Git, v5 also holds the base's own Python and the Git source build.
- `mokly-build-v6`, build reference
  `mm5vcm4xv7inkey7ad9p:b63ce806-b4a9-4567-a406-89300f259d8b` (template ID
  `mm5vcm4xv7inkey7ad9p`, build ID `b63ce806-b4a9-4567-a406-89300f259d8b`),
  E2B team `firna`. It was built 2026-11-26T12:43:06Z, in 1m10s, with
  `e2b@2.64.0` through `infra/e2b/build/build-template.mjs`, from the
  Dockerfile at `0ad58e724`. Node 24.21.0, checksum
  `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`,
  2 vCPU, 4096 MiB, base
  `debian:trixie-20261123-slim@sha256:8aa5a7bf5a1955bddbe7d74fcdd0b91ab30e74362a8b73af672b0481b35b44a0`.
  In a sandbox of it, the system was Debian 13 with glibc 2.41, Python 3.13.5,
  gcc 14.2.0 and GNU Make 4.4.1, and `git` was `/usr/bin/git` 2.47.3. Each of
  `node`, `npm`, `npx`, `corepack`, `python3` and `git` had one real file on
  `PATH`. The root filesystem used 746 MiB, and `gh` was absent. An HTTPS
  `git ls-remote` worked. In the smoke repository `mokly-ai/mokly-build-smoke`
  at `d5fe94d`, with `@mokly/mokly` 0.21.0, `npm ci` succeeded and
  `mokly build --strict` built the catalogue. After a one-commit change,
  `mokly build --config mokly.config.json --strict --base origin/main` gave
  `changesStatus: "ready"` with base commit `d5fe94d`. A forced build from
  source, `npm_config_build_from_source=true npm install utf-8-validate@6.0.5`,
  compiled its native addon. `git grep -P` with a lookahead pattern worked,
  and `git cat-file --batch --filters -Z` exited 0 in the repository. These
  checks ran from 2026-11-26T12:43:44Z to 12:44:08Z. The live probe from
  commit `0ad58e724`, with its Git, compiler and one-copy checks, printed
  `PASS live build template: assertion completed and candidate destroyed` at
  2026-11-26T12:43:32Z with the build reference.

### Environments

On 2026-11-24, main-preview had one enabled `mkc-main-preview-e2b-api-key`
version, and production had no version. On 2026-11-26, main-preview cloud
builds passed checkout and failed at Install: `npm ci --no-audit --no-fund`
exited 1 with the broken-npm error of `mokly-build-v2`. Later that day, on
`mokly-build-v3`, main-preview pull request builds published, but their check
said "Catalogue published." instead of "Catalogue ready to review.", because
the published index had `changesStatus: "unavailable"`. On 2026-11-26,
main-preview builds moved to the `mokly-build-v5` build reference. No complete
build proof is recorded yet. Record the first main-preview and production
build proofs here.
