# Repository Preview Deployments

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Deployment Contract

`.github/workflows/preview.yml` deploys a browsable copy of the example
catalogue under `examples/basic` to the direct-upload Cloudflare Pages project
`mokabook`. A `main` push updates the production deployment at
`https://mokabook.pages.dev`. Same-repository pull requests, except Release
Please pull requests, deploy to a stable `pr-<number>` branch alias and receive
one updated sticky comment with the deployment result, URL, commit, and
workflow run. Fork pull requests never receive Cloudflare credentials or
write-capable execution.

A preview job installs dependencies, builds Mokly with `npm run build`, and
builds the example with `mokly build` into an output directory under
`.context/`, outside the example root and ignored by Git. The `main` job builds the current catalogue. A pull request job
builds with `--base origin/main`, so the preview includes Changes against the
branch point; the job resolves `origin/main` from its full-history checkout.
The [static build contract](./mokly-export.md) owns the command, its options,
its output transaction, and the static site it writes: the shell stub at
`index.html`, `404.html`, and `view/<path>/index.html`, the catalogue index,
one entry detail per entry, every document, the comparison generation when a
base is given, the viewer bundle, styles, and fonts. Cloudflare Pages serves
`view/<path>/index.html` for the canonical `/view/<path>/` URLs without
rewrites, and static HTML artifacts keep Cloudflare's extensionless aliases
under the [artifact path contract](./mokly-artifact-paths.md). The output
carries no live descriptor and no event stream, so the shell browses without
live updates or live prop editing, under the
[shell delivery contract](./mokly-shell-delivery.md).

With a base, the build renders the base commit from its sources under the
[comparison contract](./mokly-comparison.md), writes the comparison generation
under an immutable generation path, and the index's `comparisonUrl` names it;
visitors fetch comparison data only after selecting a diff, and a refresh loads
that same published result. Eligible shown views offer comparison controls,
known unchanged views show Unmodified, and pages keep Changes membership but
never offer visual comparisons; the [Changes contract](./mokly-changes.md) owns
the interaction and snapshot rules. A base whose sources fail the current
validation makes Changes unavailable with those diagnostics, and the build
publishes the current content with Changes unavailable. Missing history fails
the build.

A build failure deploys nothing, and the last deployment stays live.
Replacement of the output directory uses the static build's exclusive
reservation, ownership inventory, and rollback transaction; the job adopts only
an empty directory or an output with a valid current ownership marker.

Closing a same-repository pull request marks its sticky comment inactive and
attempts to delete all Cloudflare deployments carrying that PR branch alias.
Cleanup failures keep the deployment and report why rather than hiding the
failure. Superseded runs for the same `main` ref or pull request are cancelled.
The workflow pins Node 24.21.0 and npm 11.21.0, uses immutable action commit
hashes, and deploys with the lockfile-pinned Wrangler. The
[dependency security contract](./dependency-security.md) owns the audit gate
and scoped Miniflare overrides, including their removal conditions.
