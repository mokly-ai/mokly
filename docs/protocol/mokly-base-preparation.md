# Base Source And Dependency Preparation

Status: In progress under the [Batched Base Reads plan](../../plans/batched-base-reads.md).

This page defines how Mokly prepares the sources and the dependencies of the
base side. The [comparison contract](./mokly-comparison.md#sides) owns
rendered sides. The [Git runtime](./mokly-git.md) owns history, blobs and
extraction.

## Sources

Base preparation reads one pinned commit. Base reads have separate bounds for
regular files and for total tree nodes. A root listing keeps each file's actual
POSIX spelling, lists each file once, and applies the file count bound. An
empty root list reads nothing. An explicit whole-tree root lists all regular
files. Root ownership, globs, and source diagnostics follow the catalogue
rules. Every base read returns checkout-converted bytes.

HTML, Markdown, YAML and CSS need no extraction. A base that needs
JavaScript, a renderer module, or consumer PostCSS extracts its sources. A
source archive copies checkout-converted regular files
with the pinned commit's attributes, including line endings, smudge filters,
and Git LFS downloads. Network access is allowed within the preparation
limits. The disk use of an extraction stays within the source cache capacity.
Memory use stays bounded independently of repository size. The comparison of
an opaque public resource also uses bounded memory, whatever the size of the
resource. The resource closure checks that each opaque resource is a confined
regular file. Only HTML and CSS files need reference parsing.

While a base preparation leases a complete extraction of the base commit,
base reads use the files of that extraction, which hold the same
checkout-converted bytes. A file that the extraction does not hold, such as a
name that the host cannot store, reads through Git. Before it loads the base
configuration, a preparation leases an existing complete extraction when the
working configuration names a renderer or a PostCSS module. That lookup never
builds an extraction. Decision: lease only an existing extraction before the
configuration loads. Rejected: a build at that point, because a base that
needs no sidecar would then get an extraction. Rejected: a switch only after
the dependency step, because configuration and discovery would keep their Git
reads.

If a remaining tree, file, or command budget prevents comparison, Changes is
unavailable. The diagnostic names the requested path or root and the limit.
The current build remains valid. Genuine Git command and object failures
remain fatal `git-failed` errors. A failed, timed out, or oversized conversion
makes that resource unavailable with a `base-conversion` warning, while other
base resources continue. Unavailable bytes cannot prove a resource change.
User-configured filters run with the same Git configuration as dependency
clean conversion. Raw blobs and offline-only smudge are not substitutes for
checkout bytes. Each conversion has a 120-second allowance. A failed fetch of
missing objects names the recovery command.

## Shared Render Runtime

The head and the base render with the current Mokly version. One cancellation
stops both sides, including Git reads, extraction, installation, comparison,
and public resource planning. HTML without a renderer or PostCSS follows the
[HTML dependency policy](./mokly-comparison.md#html-package-styles).

Sidecar working directories follow the [fixed source-root rule](./mokly-sidecar.md#lifecycle).
Each PostCSS context runs in a child process whose working directory is its
side's source root. This confines relative file reads and automatic Tailwind
source discovery to that side. The head and base can use the same installed
third-party dependencies while reading separate repository sources. The child
puts selected dependency directories before inherited `NODE_PATH` entries. CSS
package resolvers that read `NODE_PATH` can use those directories without
links in the source lease. Node's ESM resolver does not read `NODE_PATH`.

Historical runtime failures keep typed diagnostic codes through catalogue,
HTML, CSS, and graph wrappers. The following policy applies only to Changes;
current-side failures retain the sidecar's fail-closed command policy.

| Runtime category                     | Historical outcome                                 |
| ------------------------------------ | -------------------------------------------------- |
| Configuration, build, bundle, render | Changes unavailable: base validation failed        |
| Unavailable                          | Changes unavailable: base runtime unavailable      |
| Version                              | Changes unavailable: base runtime version mismatch |
| Cancelled                            | Fail the interrupted build                         |
| Protocol                             | Fail the build with the protocol diagnostic        |
| Timeout                              | Changes unavailable: base runtime timed out        |

A fatal failure inside a grouped attempt takes precedence over recoverable
historical validation. Internal failures remain comparison failures. A
missing base configuration still denotes an empty catalogue. Base diagnostics
are detail lines that name the full base commit and original terminal code.
A successful build has no error block. Genuine Git and internal comparison
failures use error blocks and fail the command.

## Cache Location And Ownership

The [cache contract](./mokly-base-cache.md) defines the location, bounds,
ownership, completion, reuse, and cleanup of source and dependency entries.

## Dependency Identity

The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines clean identities, supported managers, and installation cache keys.

## Installation And Bundle Settings

The [dependency contract](./mokly-base-dependencies.md#installation-and-bundle-settings)
defines npm, pnpm, and Yarn installs, their registry access, configuration,
and lifecycle scripts, version discovery, manager fallback reasons, and
sidecar directory mappings.
