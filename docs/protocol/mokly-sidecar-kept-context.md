# Sidecar Kept Build Context

This page expands the [guarded attempts](./mokly-sidecar-plans.md#guarded-attempts)
of the [Serve edit plans](./mokly-sidecar-plans.md).

## Kept Build Context

A sidecar process keeps at most one esbuild build context. Only a guarded
attempt uses the kept context. The hook list of a compile is its plugins in
order, with the kind, filter, and namespace of each hook. A guarded attempt
rebuilds the kept context of its process when its build options and its
hook list equal those of the context. Otherwise the process disposes of the
kept context and creates a new one for the attempt. Each rebuild runs the
hooks of the current request. After each rebuild, the kept context holds no
callback or data of the request that ran it.

A guarded attempt whose compile fails disposes of the kept context. A
failed proof keeps the context, and the planned attempt that follows
compiles without it. The kept context ends at `shutdown` and with its
process.

A rebuild fails exactly when a fresh compile of the same attempt fails. A
rebuild that succeeds gives the code, modules, inputs, sources, peers, and
warnings of that fresh compile. Each compile keeps its fresh identity.

Decision: a guarded attempt rebuilds the kept context of its process,
because esbuild then reuses its parse of unchanged files. On mokly-cloud
each warm edit after the first compiled about 100 ms faster.

Decision: no pool rule pins the context. Rejected: a context that the pool
pins to one process, because the head bundle rank sends each edit to the
idle process that compiled last, and a pin needs a routing rule and a
request field.

Decision: only the guarded attempt keeps a context. Rejected: contexts for
the other attempts, because they run only when a plan check or a proof
fails, or once for each root.

Decision: the first edit of a process creates the context. Rejected: a
warm-up compile before the first edit, because a session without edits
would then keep an esbuild service that it never needs.

Decision: the service of a kept context uses the default Go garbage
collector. Rejected: a lower collector target, because the first build of a
process then took about 120 ms longer and the warm edits gained nothing.
