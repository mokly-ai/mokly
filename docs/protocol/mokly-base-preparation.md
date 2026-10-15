# Base Source And Dependency Preparation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines the base preparation APIs of `mokly-compare`. The
[comparison contract](./mokly-comparison.md#sides) owns both rendered sides.
The [Git runtime](./mokly-git.md) owns history, blobs and source extraction.

## Sources

A source reader pins one commit. It lists regular files under exact
repository-relative roots and reads their bytes through Git blobs. An empty
root list starts no query. An explicit whole-tree root lists every regular
file. Overlapping queries return each path once, in lexical POSIX order.
Paths retain their actual spelling and case. Symbolic links and submodules
never supply source files. The caller applies the same configured globs,
traversal exclusions, root ownership and diagnostics as the working side.

HTML, Markdown, YAML and CSS can use blob reads without extraction. A caller
requests an extracted root only for JavaScript, a renderer module or consumer
PostCSS. It retains the source lease while a sidecar uses that root. The
extraction copies exact blobs, including files that Git export attributes
would omit or substitute.

## Cache Location And Ownership

Source and dependency caches share a repository namespace under the operating
system's cache directory. The namespace key is SHA-256 of the canonical
repository path's OS encoding. No cache file is written into the repository.
The host location adapter rejects a cache location inside that repository.

Each cache has a separate byte bound supplied at composition. Count retained
regular-file bytes and link-target bytes without following links. Reserve
1,024 bytes per entry for its completion receipt. The cache recounts entries
before eviction. It evicts the least recently used unlocked entries until
the new or reused entry fits. Access order uses a sequence under the namespace
lock, independent of wall-clock timestamps. An entry that cannot fit alongside
active leases fails with the typed cache-limit result.

Use `mokly-platform` OS locks for namespace mutation and every returned entry
lease. Acquire the entry lock before the namespace lock, so a lease waiter cannot
block unrelated cache work. Lock handles release on close. Lock files remain in place. Concurrent
callers wait with cancellation, then reuse the completed entry. An active
lease prevents eviction. A source entry is keyed by the pinned commit.

A completion receipt carries bytes, access order and a SHA-256 digest of the
complete data tree. A hit verifies the digest before reuse. Missing, damaged
or incomplete entries rebuild under their entry lock. Failed builds remove
partial data. Abandoned staging directories are removed under the namespace
lock. Symlinked cache directories fail before writes.

Source extraction builds in staging and publishes the completed directory by
rename. Dependency installation builds at its final locked location so local
package links retain their targets. Its atomically replaced completion
receipt is its publication point. No reader can acquire it before completion.
Deleting the cache is safe. A later request reconstructs the required data.

The CLI shares one announcement guard across both caches. The first open
reports the repository cache directory once per process. Plain stdout is
exactly `Mokly cache: <directory>` followed by LF. Rich output follows the
[terminal cache rule](./mokly-terminal-output.md#cache-directory).

## Dependency Identity

Read the exact bytes and POSIX paths of every repository-owned `package.json`
and package-manager lockfile on both sides. Include workspace manifests.
Do not traverse dependency, Git, build, test-output or `.context` directories.
The base inputs come from blobs. The working inputs must be confined regular
files. Equality requires the same path set and the same bytes in every file.

Equal inputs use the working installation without opening the dependency
cache or starting a package manager. Different inputs select the base lockfile
in this order: `npm-shrinkwrap.json`, `package-lock.json`, `pnpm-lock.yaml`,
`yarn.lock`, `bun.lock`, `bun.lockb`. Npm lockfiles use npm when the manifests
do not request another manager. Other managers and a missing lockfile use the
fallback tier.

The install key hashes the exact paths and bytes of the manifests and
lockfiles, and the installed package-manager version. Local `file:` or
`link:` dependencies and workspaces also include the immutable source identity, so a source
edit cannot reuse another local package's installation. These inputs use
length framing before hashing.

## Installation And Bundle Settings

Copy the extracted base sources into the private dependency entry. Run npm
without a shell using `ci --ignore-scripts --no-audit --no-fund --cache
.npm-cache --logs-dir .npm-cache/_logs --prefix {private-directory}`. Set the matching npm script, audit, fund and update-notifier
environment settings. Explicit cache, log and prefix arguments override consumer locations.
Downloads and npm logs stay in that bounded entry.
On Windows, a native npm executable runs directly. A standard PATH npm
`.cmd` installation runs through its `npm-cli.js` and Node without a shell.
An unsupported selected shim falls back; the extracted source directory
never supplies a package-manager executable.

Lifecycle scripts do not run. Local package and workspace paths must stay
inside the extracted root; an escaping or malformed input uses the fallback. The command has an explicit monotonic time
limit and a byte limit that supervision checks while it runs. Tests use a
fake clock for that limit. Integration fixtures use offline npm configuration
and local file dependencies, with no registry.

An unsupported manager, unavailable command, failed or offline install,
expired deadline or exceeded cache bound uses the working installation.
Cancellation stops preparation and never becomes a fallback warning.
Processes retain their owned groups or jobs through exit and pipe closure.
The supervisor also stops remaining helpers.

The result carries the selected `node_modules` directory and the
`ModuleResolution` value for the sidecar's bundle request. The request's
package roots are repository-relative. The result names the selected
installation root followed by the corresponding package roots there, in
order. Aliases, conditions, fields, extensions and loaders keep their values.
The caller retains the dependency lease until the bundle releases the files.

A fallback returns a configuration-subject `base-dependencies` warning.
It names the first differing lockfile in lexical order. A manifest-only
change names the base's selected lockfile. If neither side has a lockfile,
it uses `no lockfile`. Its one-line message is:

```text
base dependencies differ at "<lockfile>"; using working-tree dependencies
```

The [build warning contract](./mokly-build-warnings.md) owns normalization,
strict mode and terminal presentation. The warning never enters catalogue
JSON or a document.
