# Mockup Comparison Base

This is the comparison sub-contract of [Mockup tooling](./mockup-tooling.md).
The installed release's `mokly-comparison.md`, `mokly-base-preparation.md`,
`mokly-base-dependencies.md` and `mokly-base-cache.md` are the producer
contract.

## Base Selection

`review.base` stays `origin/main`. Mokly pins the merge base of that ref and
`HEAD` as the comparison base; the base is not necessarily the current main
tip. `--base` names another ref for one `serve`, `build` or `publish`
command.

## Base Rendering

Mokly renders the base side from the base commit's sources with the installed
release, through the base commit's own `mokly.config.json`, renderer and
module resolution. The configuration names no rebuild recipe,
no command installs or runs an earlier Mokly release, and no comparison reads
a committed generated tree. A Mokly upgrade alone therefore
lists no change.

A base commit without `mokly.config.json` has an empty catalogue, so every
current entry is added. A base whose sources fail current
validation makes Changes unavailable with those diagnostics in every command,
and the build completes without a comparison.

A base ref that cannot be resolved, or a history too shallow for the merge
base, leaves Changes unavailable in a browsable Serve. The same
base fails `build` and `publish` with `git-failed`. Unavailable
Changes are not a successful comparison with zero Changes. Preview capture
requires a comparison and rejects an upload without one.

## Base Dependencies

React screens and the renderer need the base's JavaScript, so Mokly extracts
the base commit's sources into its cache outside the repository.
Repository packages, such as the tokens npm workspace, always
come from the base commit's own sources. When the base's
`package-lock.json` and package manifests equal the working tree's, the base
resolves third-party packages from the working tree's installation.
Otherwise Mokly installs the base's locked dependencies into
its cache with `npm ci`. When that install cannot run, or lacks a
dependency directory that the head uses, the base falls back to the working
tree's packages. That fallback raises a `base-dependencies`
warning, which never fails a `--strict` build.

## Serve And Fixture Exceptions

The served tests start Serve with a `--base` that names a missing ref, so
Changes stay unavailable and no base is extracted or installed;
[Mockup verification](./mockup-verification.md#disk-and-http-smoke) defines
the suite. The contract fixture and the live publish smoke
commit only sources in their temporary Git repositories, and their
comparisons render the base from those sources.

## Cache And Limits

Mokly keeps the extracted base sources and the base dependency installs in a
bounded cache under the operating system's cache directory, never in the
repository. The installed release's `mokly-base-cache.md`
defines its bounds, leases, reuse and cleanup. Deleting that cache is safe. A
comparison that passes a tree, file or command bound makes Changes unavailable
with a diagnostic that names the limit, and the current build stays valid.

## Trust

Run comparisons only against trusted `origin/main` history. The base side runs
the base commit's renderer and entry modules, so a comparison executes that
commit's code. A base install trusts the base commit as the project's own
install of that commit does. The
configuration leaves `review.baseInstallScripts` unset, so a base install runs
no lifecycle scripts. Each base install starts from an allowed
list of environment variables that holds no secret, so no base configuration
reads an inherited token. This environment filter is not a
sandbox. A base install needs npm registry access unless its packages are
cached.

`build --no-changes` and `publish --no-changes` skip the base.
Preview capture requires a comparison and cannot use a current-only
publication. The preview publisher has a separate 15-minute deadline that
includes the base side and the upload; see
[Preview capture](./preview-capture.md).
