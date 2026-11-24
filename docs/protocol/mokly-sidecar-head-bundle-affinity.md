# Sidecar Head Bundle Affinity

For a head `bundle` or a head `transformViteCss` call, the pool ranks the idle
processes of the head root by their last compile, newest first. Processes
without a compile follow in the queue order. A successful `bundle` counts as a
compile unless its [`cache` value](./mokly-timings.md#core-spans) is `memory`
or `hit`. A compile belongs to its process, so a new process in the same slot
has none. Neither call waits for a busy process while another slot can run it.
A PostCSS preparation does not change this rank. Its context belongs to the
slot of the bundle from the start of the bundle.

Decision: a head `bundle` prefers the process that compiled last, so fewer
processes keep an idle compiler in memory. Rejected: the queue order, because
bundles then rotate across processes. Rejected: one remembered process,
because after a busy fallback it no longer prefers the older compiler.

Decision: a head `transformViteCss` call reuses the Vite server of the last
compiler. Rejected: the queue order, which can lead to a second Vite server.
