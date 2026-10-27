# Sidecar Memory Sampling

This page expands the [sidecar lifecycle](./mokly-sidecar.md#lifecycle).
The memory limit is 1 GiB of resident memory across one sidecar and its Node
descendants. Native helpers are excluded when the root executable is known.
Unknown root identity includes all descendants conservatively.

A sample measures only processes that the sidecar owns. It discovers new
descendants at spawn, at the first sample after `processCss`, and every 64
samples. A Node binary started through a symlink matches its forked
children.

A fresh worker finishes one request before memory recycling can start.
After a memory recycle, the slot doubles the completed requests before the
replacement's first memory check: 4, 8, 16, and so on, with a maximum of 500.
The schedule survives worker replacement. A sample at or below 1 GiB resets
it to normal per-request checks and clears the pressure notice. The 500-render
rule applies independently. Each in-flight request completes before recycling starts.

When a replacement's first check remains over the bound, emit one diagnostic
line for that pressure episode. Further high checks increase the delay without
repeating that line. A low sample permits a later episode to report again.

For direct native runs, `MOKLY_NODE_EXECUTABLE` must name the real Node binary
when PATH supplies a launcher that starts Node as a child. A non-Node launcher
is not the Node root and cannot account for its Node descendants correctly.

PostCSS children terminate with their sidecar under the
[lifecycle rules](./mokly-sidecar.md#lifecycle).
