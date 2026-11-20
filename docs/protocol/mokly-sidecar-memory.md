# Sidecar Memory

This page expands the [sidecar lifecycle](./mokly-sidecar.md#lifecycle). It
defines the memory limit of each sidecar, the memory admission of a default
pool, and the claims that Serve holds for its sidecar calls.

## Sampling And Recycling

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
it to normal per-request checks and clears the pressure notice. Each in-flight
request completes before recycling starts.

When a replacement's first check remains over the bound, emit one diagnostic
line for that pressure episode. Further high checks increase the delay without
repeating that line. A low sample permits a later episode to report again.

The 500-render rule applies independently of the memory checks. Each render
request and each [return warm-up](./mokly-sidecar-return-warmup.md#end) replay
adds one to the render count of its process. The pool recycles a process after
the render request that brings its render count to 500. A warm-up replay never
brings the count to 500.

For direct native runs, `MOKLY_NODE_EXECUTABLE` must name the real Node binary
when PATH supplies a launcher that starts Node as a child. A non-Node launcher
is not the Node root and cannot account for its Node descendants correctly.

PostCSS children terminate with their sidecar under the
[lifecycle rules](./mokly-sidecar.md#lifecycle).

## Default Admission

A size from `--sidecars` or `MOKLY_SIDECARS` is exact. Such a pool starts
sidecars up to that size without a memory check. The other rules of this
section apply only to a pool with the default size.

Each slot of a pool holds one sidecar at a time. The core count bounds the
slots of a default pool. The pool reserves a slot only when it starts the first
sidecar in that slot. Each reservation has a budget of 1 GiB, the memory limit
of one sidecar. The first usable reservation always succeeds, so work can
always make progress.

Each further reservation needs admission. The pool admits it only when the
[memory estimate](#memory-estimate) is at least the sum of these amounts:

- The budget of the new reservation.
- For each other reservation, its budget minus the latest memory sample of
  its current sidecar, and at least zero. A reservation without such a sample
  counts its whole budget.
- The budgets that live [claims](#claims) hold.
- 1 GiB of spare host memory for the binary and native helpers.

The estimate already excludes the memory that live sidecars use, so the sum
counts only the unused part of each budget. Admissions happen one at a time.
Each one counts every earlier reservation, also a reservation whose sidecar
still starts.

When the pool denies growth, the request uses an idle reserved slot under the
[root scheduling rules](./mokly-sidecar-root-scheduling.md), or it waits for
one in the queue. A denial applies only to its own check. A later check reads
the estimate again, so the pool can grow after memory recovers.

An unknown estimate admits no further reservation. The first usable
reservation and every existing reservation stay available.

A low or unknown estimate never ends a sidecar and never shrinks the
reservations of a pool. Recycling, failed-worker replacement, and root
replacement keep the reservation of their slot without a new check. A
reservation ends only when its slot goes out of use for the life of the pool,
or when the pool stops. Each command applies these rules to its one pool.
Head and base requests share its reservations, in Serve and in build.

Decision: an explicit size skips admission. Rejected: admission for every
pool, because an explicit size is the user's exact choice.

Decision: a default pool checks memory at each growth. Rejected: a fixed
default from physical memory at startup, because it cannot react to other
programs. Rejected: ending idle sidecars while memory is low, because the pool
would lose warm bundles and compile them again.

Decision: each reservation keeps its whole budget, less the memory that its
sidecar already uses. Rejected: a check of the new budget alone, because
concurrent starts could admit against the same memory. Rejected: a budget
from the observed peak, because an early peak does not bound a later render.

Decision: an unknown estimate admits no further reservation. Rejected: the
core count for an unknown estimate, because it gives no memory evidence for
more sidecars.

## Memory Estimate

The estimate is the physical memory that the command can still use without
swap. Swap never counts as free memory.

- On Linux, the host value is `MemAvailable` from `/proc/meminfo`.
- On macOS, the host value is physical memory minus app, wired, and
  compressed memory. File cache and purgeable memory count as free.
- On Windows, the host value is the available physical memory.

On Linux, the cgroup v2 memory limits of the command's cgroup and of each
ancestor also apply. A level with a finite `memory.max` or `memory.high` gives
one value. That value is its smaller finite limit minus `memory.current`, plus
`inactive_file` from `memory.stat`. The estimate is the smallest of the host
value and these values. A level without a finite limit gives no value. When no
cgroup memory controller applies, the host value is the estimate.

A Linux cgroup v1 leaf uses its finite `memory.limit_in_bytes` and
`memory.usage_in_bytes`. It credits `total_inactive_file` from `memory.stat`,
or `inactive_file` when the recursive field is absent. An ancestor applies
only when `memory.use_hierarchy` accounts for descendants. The kernel's
unbounded limit gives no value. These values combine with the host and other
applicable limits in the same way as v2 values.

The estimate is unknown when the host reading reports zero physical or zero
used memory. It is also unknown when a memory controller applies to a level
but the limits of that level cannot be read. A finite level whose
`memory.current` or `memory.stat` cannot be read also makes it unknown.

Decision: the estimate counts reclaimable file cache as free. Rejected: raw
free memory and a cgroup limit minus its current use, because both count file
cache as used. Rejected: the macOS available-memory value, because it counts
active app memory as free.

## Capacity

The capacity of a pool is the number of sidecars that it can run now. For an
exact size, the capacity is that size. For a default pool, the capacity is
memory-permitted. It counts the reservations, the budgets that live claims
hold, and the largest number of further new reservations whose budgets fit
together now. They fit when the estimate is at least their budgets, the unused
budgets of the existing reservations, the budgets that live claims hold, and
the spare host memory. The core count bounds the capacity. It is at least one,
and never less than the reservations and the budgets that live claims hold.
Serve bounds its sidecar admission and its background batch by the capacity
under the
[on-demand rules](./mokly-on-demand.md#background-work-and-replacement). A
capacity reading takes no claim and makes no reservation.

Decision: the capacity counts the new reservations that fit now. Rejected: the
existing reservations alone, because Serve would then keep one call at a time
on a pool that started one sidecar.

## Claims

Serve admits each sidecar call with a claim under the
[on-demand rules](./mokly-on-demand.md#background-work-and-replacement). A
claim holds a place for one call within the capacity. The pool grants a claim
only while its live claims are fewer than its capacity. It grants claims and
admits reservations one at a time.

A grant adds held budgets of new reservations only when the live claims already
use every reservation and every held budget. The grant admits those budgets.
So a claimed call that starts a sidecar in a new slot takes one held budget
without a new memory check. Without a held budget, the start needs admission
as a new reservation. A claim never becomes a reservation in another way.

A claim ends when its call ends, also when the call fails or is cancelled. A
low or unknown estimate does not end it. So work that starts no sidecar in a
new slot leaves no reservation. Examples are an HTML render and a call that an
idle sidecar serves.

Decision: a claim lasts only as long as its call. Rejected: a reservation for
each admitted call, because work that starts no sidecar would keep it, and a
later start in it would skip the memory check. Rejected: a new memory check
when a claimed call starts a sidecar, because a denied call would then wait in
the pool queue ahead of later foreground calls.
