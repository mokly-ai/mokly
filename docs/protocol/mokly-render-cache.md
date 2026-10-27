# Mokly Render Graph And Cache

## Render Graph

Every output is a node of the content-addressed render graph that the
[architecture page](../architecture/rust-core.md#render-graph) defines, keyed
by the hash of its inputs. A screen or component renders once per view, that is
per viewport and colour scheme. A page renders once. A Markdown document
renders once per enabled colour scheme. A node recomputes only when its key
moves. Fragments are memoized across screens, so a component rendered with the
same props on many screens renders once.

## Render Cache And Captures

The render cache is process memory. It is bounded by bytes and evicted least
recently used. Serve reads head documents from the render cache. An evicted
head document renders again on the head root. `build` and `publish` capture the
head once during the build check under a separate 256 MiB bound. Changes,
output, and comparison output read that capture. An uncaptured head document is
read from the head source, which renders it again only after render-cache
eviction.

Changes captures the base within 256 MiB in Serve and in `build`. A base capture
miss uses the pinned source.

Decision: capture the head once with the tested capture path. A larger render
cache, bounded render batches, and a reordered build were rejected because the
first repeats the limit problem, the second repeats renders, and the third
changes build order.

Decision: each side has its own 256 MiB capture bound, and a shared bound was
rejected because the head is captured first and could leave no room for the
base.

## Disk Caches

The base-side extraction cache and the dependency install cache live in the
operating system's cache directory under a key derived from the repository
path. Each cache has its own byte bound and least-recently-used eviction. The
terminal names that directory, and deleting it is safe. No cache is in the
repository.
