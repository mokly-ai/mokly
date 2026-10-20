# Base Dependencies

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines dependency preparation for the [comparison sides](./mokly-comparison.md#sides).
[Base preparation](./mokly-base-preparation.md) owns sources, cache bounds,
leases, cancellation, and completion.

## Dependency Identity

The base input set contains every tracked repository package manifest and
lockfile from blobs, including workspace manifests. With pnpm or Yarn lockfiles,
additional manager configuration inputs include `pnpm-workspace.yaml`, `.yarnrc.yml`, `.yarnrc`, and `.npmrc`.
Npm-only repositories keep manifest and lockfile identity. The working input set
comes from `git ls-files -z --cached --others --exclude-standard`. It does
not walk ignored trees, nested clones or submodules. Dependency trees under
`node_modules` are excluded on both sides. There is no application-specific
list of excluded build directories.

Each working input must be a confined regular file. Equal working and base
bytes reuse the base identity without a Git process. Hash the remaining
confined paths in one `hash-object --stdin-paths` call, without writing objects,
and compare their Git clean identities with the corresponding base blob ids.
This applies line ending and
clean-filter conversion. Equal identities use the base blob bytes in the
input set. A changed file or path set differs. This normalization is for
dependency identity only; it does not change base render or resource bytes.

Repository-owned workspace and local directory packages always resolve from
the side's own sources, in every tier. During bundling, a resolved real path
inside a repository root and outside every `node_modules` directory maps to
the same relative path under the side's source root. A missing mapped file
fails closed with `bundle-failed`. This covers repository packages for npm,
pnpm, Yarn and Bun without a package manifest inventory. Nested
`node_modules` directories retain the selected third-party dependencies.

Equal dependency identities reuse working third-party dependencies without
install validation, including for outside `file:` packages. Importer lookup
uses the matching directory in the selected dependency repository.
Different inputs install each supported lockfile root selected by configuration
ancestors and `moduleResolution.packageRoots`, including their ancestors. A nested app with no root
lockfile is valid.
An independent configured lockfile gets its own install. A root's
`packageManager` selects its manager when present. Otherwise its lockfile
selects the manager. Prefer `npm-shrinkwrap.json` over `package-lock.json` for
npm. Support npm, pnpm 10 through 12, Yarn Classic 1, and Yarn Berry 4 with
`nodeLinker: node-modules`. Yarn Classic uses a v1 lockfile. Berry uses the
lockfile metadata and `.yarnrc.yml`. Berry's default or explicit Plug'n'Play
linker uses tier three because the sidecar has no Plug'n'Play resolver.
Bun, missing lockfiles, and unsupported versions keep tier three.
Equal identities need no manager validation.

For pnpm and Yarn, an exact `packageManager` version must match the executable.
An optional Corepack integrity suffix does not change the version comparison.
Mokly does not download or update package-manager executables. A PATH-installed
manager or Corepack shim must already supply the selected version. Corepack
network access, remote version refresh, automatic pinning, and project
environment files are disabled.

The install key length-frames all manifest and lockfile paths and bytes, the
manager families and actual versions, manager configuration inputs, and the
selected install roots. Local package paths, archives,
overrides and workspaces also add the immutable source identity. pnpm and Yarn
installs always include it because their lockfiles and configurations can
select local archives, patches, and workspace sources. Recognize
`file:`, `link:`, Yarn `portal:` and patch paths, pnpm overrides and workspace
paths, bare relative and absolute paths, home paths and local
`.tgz`, `.tar.gz` and `.tar` specifications. Normalize relative paths from
the declaring manifest. Yarn patch references validate each patch and its
source. Their `~/` prefix is relative to the Yarn project, not the home
directory. Built-in patches need no local path. A local path outside the repository, including a home
or absolute path, uses a typed fallback reason when an install is needed.
No install reads it.

## Installation And Bundle Settings

Configuration ancestors use Node's order, from the configuration directory
through the repository root. Every ancestor `node_modules` maps to the same
relative directory under the selected dependency installation. JavaScript
`nodePaths` and CSS use this order before explicit package roots. Tiers one
and three use working directories; tier two uses the directories created by
its base install. If the head used an ancestor directory absent from tier two,
select tier three with a `base-dependencies` warning naming that directory.
JavaScript, stylesheet, and PostCSS package reads establish this usage.
An unused ancestor directory does not cause a warning.

Tracked base files supply their bytes before installed copies. Other bare
imports start at the matching importer directory in the selected installation,
before configuration and explicit package-root fallback. Source aliases and
tsconfig paths use base files. Working tsconfig paths cannot remap base package imports.
An unmappable lookup selects tier three with a `base-dependencies` warning. Each fallback emits its typed trace reason.

Copy the base sources into the private dependency entry. Install without a
shell. Lifecycle scripts do not run, including workspace scripts and scripts
that dependency metadata would otherwise enable. pnpm and Yarn installs are
offline. They use local archives or offline cache data copied with the base
sources. Missing offline packages use tier three. They do not read or change
the working installation or a shared package store.

| Manager            | Locked install policy                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| npm                | `ci --ignore-scripts --no-audit --no-fund`                                                            |
| pnpm 10 through 12 | `install --offline --frozen-lockfile --ignore-scripts`; disable pnpmfile hooks and manager switching  |
| Yarn Classic 1     | `install --offline --frozen-lockfile --ignore-scripts --non-interactive`; ignore external RC settings |
| Yarn Berry 4       | `install --immutable --mode=skip-build`; disable network, scripts, telemetry, and shared mirrors      |

All install caches, logs, stores, module directories, and installation state
stay inside the private entry. Remove temporary download caches before byte
counting and durability synchronization. Installed pnpm links continue to
resolve inside their private `node_modules` store. Yarn node modules use the
same selected-directory mapping as npm. Yarn path redirection is disabled.
Berry configurations with executable plugins or per-host network overrides
use the fallback tier.

Resolve managers in the parent through absolute PATH entries only. The child
also receives only absolute PATH entries, so a script interpreter cannot
select historical code. On Windows a native launcher runs directly. Standard
npm-installed and Corepack `.cmd` layouts use their Node CLI. A source
directory or relative PATH entry never supplies the manager. Unsupported
launchers fall back.

Version discovery and every selected install share one monotonic deadline.
Size supervision walks the whole private entry at most once per second.
Vanished files or directories do not stop the install. Only a failed spawn
or unavailable executable has the typed command-unavailable result. Tests
use fake time and local offline fixtures without registry access.

The result carries third-party `node_modules`, the install lease when needed,
the complete sidecar `ModuleResolution`, and typed repository root paths.
Package roots name configuration ancestors, then explicit package roots,
all inside the selected tier, in Node's order. Repository roots include the working repository root
in every tier and the copied base repository root inside a tier-two install.
Core `moduleResolution.dependencyRoot` names the selected installation repository.
The sidecar maps repository sources back to its source root. Other settings keep their values. Retain the install and extraction leases while bundling.
Cancellation stops preparation and never becomes a fallback warning.

A fallback returns a configuration-subject `base-dependencies` warning. Use
the first differing lockfile in lexical order, or the selected base lockfile
at the first selected install root for a manifest-only change. Prefer
`npm-shrinkwrap.json` there. Ignore unrelated lockfiles. With no selected
lockfile omit the location clause:

```text
base dependencies at "<lockfile>" could not be installed (time limit); using working-tree dependencies
base dependencies could not be installed (package manager or lockfile unavailable); using working-tree dependencies
base dependencies at "<lockfile>" lack "<directory>"; using working-tree dependencies
base dependency lookup cannot preserve "<directory>"; using working-tree dependencies (configure moduleResolution.packageRoots)
```

Other typed reasons are `installation failed`, `cache size limit`,
`local package outside the repository`, `invalid dependency input` and
`cache unavailable`, `package manager version unsupported`, and
`Yarn Plug'n'Play is unsupported`. The [build warning contract](./mokly-build-warnings.md)
owns strict mode and terminal presentation. Warnings never enter documents
or catalogue JSON.
