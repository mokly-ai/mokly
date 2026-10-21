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
selected install roots. Local package paths, archives, overrides and
workspaces also add the immutable source identity. pnpm and Yarn installs
always include it because their lockfiles and configurations can select local
archives, patches, and workspace sources.

Recognize `file:`, `link:`, Yarn `portal:` and patch paths, pnpm overrides and
workspace paths, bare relative and absolute paths, home paths and local
`.tgz`, `.tar.gz` and `.tar` specifications. Normalize relative paths from the
declaring manifest. A workspace pattern falls back when any of its brace
expansions leaves the repository, with `**` counted as zero folders. Yarn
Classic rewrites `file:` and `link:` dependency values from their manifest
folder, so those normalize from the declaring manifest. Classic resolves every
other local value from its lockfile folder, so those normalize from that
folder.

Normalize each lockfile value from the folder that its manager reads it from:
pnpm importer specifiers and `link:` versions from their importer, other pnpm
values and all Yarn Classic values from the lockfile folder, and Yarn Berry
values from the workspace that their locator names. A pnpm value whose
position an alias, a merge key, or a complex key can change normalizes from
the repository root. Equal text in another position gets no exemption, because
the manager reads that position from another folder. npm `packages` keys, link
targets, `resolved` values, and v1 `version` values use the lockfile folder. A
lockfile that does not parse uses the `invalid dependency input` fallback.

Yarn patch references validate each patch and its source. Their `~/` prefix is
relative to the Yarn project, not the home directory. Built-in patches need no
local path. A local path outside the repository, including a home or absolute
path, uses a typed fallback reason when an install is needed. No install reads
it.

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
shell. Lifecycle scripts do not run by default, including workspace scripts and
scripts that dependency metadata would otherwise enable. The working-tree
`review.baseInstallScripts` setting or its command-line override enables them
for one invocation. Installs do not read or change the working installation or
a shared package store.

Every manager may download packages from the registry that the base and user
configuration select, as npm does. Installs use registry access rather than
offline mode, because offline installs reached tier two only when a repository
committed its archives or offline data. Git transports stay off, so no install
clones a Git repository. Yarn Berry Git and GitHub sources use the fallback
tier, because Berry packs them with their own scripts. Corepack network access
stays off, and Mokly never downloads or updates a package-manager executable.
The time, byte, and cache bounds also bound downloads. A failed download uses
tier three.

Each manager reads the base project configuration and the user configuration,
with its credentials, as npm reads `.npmrc`: pnpm reads `.npmrc` and
`pnpm-workspace.yaml`, Yarn Classic reads `.yarnrc` and `.npmrc`, and Yarn
Berry reads `.yarnrc.yml`. Each install starts from an allowed list of
environment variables, not the inherited environment, so no base configuration
can read an inherited secret such as `MOKLY_TOKEN`, `GITHUB_TOKEN`, or
`NPM_TOKEN`. The allowed list holds no secret:

- `PATH` and `HOME`.
- The proxy variables `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and `ALL_PROXY`,
  in upper and lower case.
- The certificate variables `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, and
  `SSL_CERT_DIR`.
- The variables that a process needs to start. Unix uses `TMPDIR`, `LANG`,
  `LC_ALL`, every `LC_*`, `TZ`, `USER`, and `LOGNAME`. Windows uses
  `SystemRoot`, `windir`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`, `USERPROFILE`,
  `APPDATA`, `LOCALAPPDATA`, `HOMEDRIVE`, `HOMEPATH`, `NUMBER_OF_PROCESSORS`,
  and `PROCESSOR_ARCHITECTURE`.
- The names that Mokly fixes, with the values that Mokly sets.

Mokly removes every other inherited variable. Windows matches a variable name
without case. A private registry whose token comes only from the environment,
for example `NODE_AUTH_TOKEN` or a user `.npmrc` that reads `${NPM_TOKEN}`, no
longer authenticates in a base install, so that base uses the fallback tier
with the install-failed reason. Yarn Classic needs rules that npm does not
have, because its configuration files can move folders that it creates: Mokly
fixes its working folder, cache, global, link, modules, and offline cache
folders, its offline mirror, and its lock file inside the private entry. A
confined committed offline mirror stays in use. The Classic self-update check
stays off.

| Manager            | Locked install policy                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| npm                | `ci --ignore-scripts --no-audit --no-fund` by default; omit `--ignore-scripts` when enabled                                     |
| pnpm 10 through 12 | `install --frozen-lockfile --ignore-scripts` by default; omit it when enabled; disable pnpmfile hooks and manager switching     |
| Yarn Classic 1     | `install --frozen-lockfile --ignore-scripts --non-interactive` by default; omit it when enabled; fix its folders and mirror     |
| Yarn Berry 4       | `install --immutable --mode=skip-build` by default; omit `--mode=skip-build` when enabled; disable telemetry and shared mirrors |

All install caches, logs, stores, module directories, and installation state
stay inside the private entry. Remove temporary download caches before byte
counting and durability synchronization. Installed pnpm links continue to
resolve inside their private `node_modules` store. Yarn node modules use the
same selected-directory mapping as npm. Yarn path redirection is disabled.
Yarn Berry reads no project environment file: Mokly replaces Berry's
environment-file list with one optional path above the private entry, so an
`injectEnvironmentFiles` setting in a base `.yarnrc.yml` reads nothing and
sends nothing. Berry configurations with executable plugins, per-host network
overrides, or a `defaultProtocol` other than `npm:` use the fallback tier. A Yarn `exec:`
source uses the fallback tier wherever it appears, also inside a patch
source, a catalog, or a package extension, because Berry runs its generator
during resolution. Berry `catalog`, `catalogs`, and `packageExtensions`
ranges get the manifest path checks from their configuration folder.

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
use fake time, local archives, and a local registry. No test uses the internet.

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
