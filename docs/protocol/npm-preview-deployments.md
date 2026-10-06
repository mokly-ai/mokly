# Repository Preview Deployments

## Delivery Status

The main-branch and pull-request preview workflows, static capture, publication,
replacement, and cleanup behavior are implemented.
The [task cache contract](./ci-remote-cache.md) defines planned cached
package/example preparation; capture and deployment remain uncached.

## Deployment Contract

After task-cache delivery, eligible same-repository preview jobs may read and
write signed artifacts. They map the writer and signature secrets only when
both exist; otherwise they use local cache only. Fork gating stays unchanged.
The first Turbo use disables hosted telemetry. Historical comparison rebuilds
use the baseline commit's own build scripts; they may restore tool builds but
still execute the configured direct example build. Capture, input-mutation
checks, publication, replacement, and cleanup always execute independently.

The [publication option](./mokly-publication.md) is implemented. The main job
publishes the current catalogue with `npm run preview:build`; PR previews use
`npm run preview:build -- --include-changes --base origin/main`.

The [consumer static exporter](./mokly-export.md) provides shared output safety
and static delivery. This document describes the repository's deployment
adapter; consumer `mokly export` produces files without deploying or publishing
npm.

`.github/workflows/preview.yml` deploys a browsable copy of the synthetic basic
consumer to the existing direct-upload Cloudflare Pages project `mokabook`. The
infrastructure identifier remains unchanged during the npm rename. A `main`
push updates the production deployment at `https://mokabook.pages.dev`.
Same-repository pull requests, except Release Please pull requests, deploy to a
stable `pr-<number>` branch alias and receive one updated sticky comment with
the deployment result, URL, commit, and workflow run. Fork pull requests never
receive Cloudflare credentials or write-capable execution.

`npm run preview:build` first rebuilds Mokly and its derived basic consumer.
The repository-only preview builder starts the real Browse server on an
ephemeral loopback port and snapshots the home, not-found, and current entry
shells at `view/<path>/index.html`, plus removed-entry shells only when Changes
is included. It copies the
shell stylesheet, browser and shared navigation modules, fonts, and every
validated public consumer asset into `.context/mokly-preview`. HTML copies pass
through the same manifest/header-aware logical-link adapter as served Browse;
unowned reserved metadata is removed and invalid trusted output fails the
build. Preview shell links use the canonical `/view/<path>/` URLs, which
Cloudflare Pages serves from `view/<path>/index.html` without rewrites; static
HTML artifacts keep Cloudflare's extensionless aliases under the
[artifact path contract](./mokly-artifact-paths.md). Static shell HTML omits the
watched server's live-update entrypoint.
The parent client validates one optional `fragment` query and applies its
encoded hash to every applicable current and light/dark frame source, with
first-step-only use-case scope.

Default capture needs no Git or comparison provider and omits review controls,
counts, removed entries, and baseline artifacts. Explicit Changes capture pins
one merge-base commit for impact and screen and component variant comparisons
and rejects any input mutation during capture. It packages comparison JSON and
isolated resources under an immutable generation path; visitors fetch them only
after selecting a diff. Refresh loads that same published result. Unavailable
requested baselines or invalid comparisons abort the build without replacing
previous output.

Both options omit the live-update entrypoint, watch-only modules, event routes,
and stale comparison directories. Full history remains available in both jobs.
Static shell metadata addresses an included comparison generation directly;
the stable comparison redirect remains available when Changes is enabled.
Eligible shown views offer comparison controls; known unchanged views show
Unmodified. Missing per-view evidence uses entry-level status and eligibility;
absent change evidence never invents a status. Pages retain Changes membership
but never offer visual comparisons. The
[Changes contract](./mokly-changes.md) owns the shared interaction and snapshot
rules. Artifact replacement uses the shared exclusive reservation, ownership
inventory, and rollback transaction. The adapter requires current schema-2
export ownership; an earlier `.mokly-preview-artifact` cannot authorize replacing
any file or adopting pre-derived `view/` paths. See [export safety](./mokly-export-safety.md).

Closing a same-repository pull request marks its sticky comment inactive and
attempts to delete all Cloudflare deployments carrying that PR branch alias.
Cleanup failures retain the deployment and report why rather than hiding the
failure. Superseded runs for the same main ref or pull request are cancelled.
All workflow actions use immutable commit hashes and Wrangler is lockfile-pinned.
The [dependency security contract](./dependency-security.md) owns the audit
gate and scoped Miniflare overrides, including their removal conditions.
