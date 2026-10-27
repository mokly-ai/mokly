# Render Graph And Cache

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Render Graph And Cache

Every output is a node of the content-addressed render graph. A screen or
component renders once per view. A page renders once. A Markdown document
renders once per enabled colour scheme. A node recomputes only when its key
moves. Fragments are memoized across screens when their inputs match.

The render cache is process memory. It is bounded by bytes and evicted least
recently used. Serve reads its head documents from this cache. `build` and
`publish` capture the head once during the build check under a separate 256 MiB
bound. Changes, output, and comparison output read that head capture. A head
document that does not fit uses the head source and can render again.

Changes captures the base within 256 MiB in Serve and in `build`. A base capture
miss uses the pinned source. A base document that does not fit uses that source
when a later comparison read needs it. The base-side extraction cache and the
dependency install cache live in the operating system's cache directory under
a key derived from the repository path. Each cache has its own byte bound, and
the terminal names that cache directory. No cache is in the repository.

Decision 1: capture the head once with the tested capture path. A larger render
cache, bounded render batches, and a reordered build were rejected because the
first repeats the limit problem, the second repeats renders, and the third
changes build order.

Decision 2: each side has its own 256 MiB capture bound, and a shared bound was
rejected because the head is captured first and could leave no room for the
base.

Serve keeps reading head documents from the render cache. An evicted Serve
document renders again from the head root. Serve's base capture keeps its
separate 256 MiB bound beside the render cache.

## Build

`mokly build` runs discovery and validation, renders every view in the build
check, and keeps captured documents for Changes and output. It reports
warnings and writes the static site into the directory `--out` names,
`mokly-static/` at the repository root by default, which Git must ignore. It
writes the shell stub per route, the index, one detail per entry, every
document, the comparison generation, the viewer bundle, styles, and fonts
under the [static build contract](./mokly-export.md) and the
[static delivery contract](./mokly-export-delivery.md). An error fails the
command before any file is written. With `--strict`, a warning fails it too.
The output transaction stages the whole site, replaces the output directory in
one step, and rolls back on failure, so the last successful output stays in
place. A validation-only run is a build to a temporary directory.

`publish` runs the same build path in its private directory before it uploads
the result through the [upload exchange](./mokly-upload-exchange.md).
