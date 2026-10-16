# Sidecar Memory Sampling

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page expands the [sidecar lifecycle](./mokly-sidecar.md#lifecycle).
The memory limit is 1 GiB of resident memory across one sidecar and its Node
descendants. Native helpers are excluded when the root executable is known.
Unknown root identity includes all descendants conservatively.

Each worker has one persistent process table containing only owned processes.
A full discovery uses a temporary parent-only process table. It reads no host
executable or resident-memory details. That table closes after selecting the
owned subtree. The persistent table refreshes memory and executable metadata
only for those processes. It discards entries that leave the subtree.

Discovery runs at spawn, after `processCss` at the next memory sample, and
every 64 samples. Other samples refresh only known children. Executable paths
are canonicalized and cached by PID, start time, and authored path. This
makes a Node binary started through a symlink match its forked children.

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

The 64:256 operation-count test covers periodic discovery boundaries.
Canonicalization remains once per process identity. The mocked alias test
proves identity matching on every platform. The real symlink test requires
the hosted macOS and Windows jobs to verify their OS executable metadata.

PostCSS children use the parent-pipe watchdog too. A blocked plugin terminates
when its sidecar dies. This applies to working and historical source contexts.
