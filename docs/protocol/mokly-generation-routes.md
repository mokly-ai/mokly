# Accepted Generation Route Set

## Delivery Status

This is the approved in-memory output-snapshot contract for the
[path/output integration](./mokly-path-output-integration.md). It retains
generation route validation without reading generated files from disk.

## Shape And Construction

```ts
interface OutputSnapshot {
  schemaVersion: 1;
  routes: readonly string[];
}
```

Every route is a safe generated-root-relative path. Sort by UTF-16 code units,
reject duplicate/case-folded and file-directory collisions, and include every
generated HTML, compiled stylesheet, copied CSS/Markdown asset and the private
manifest route. Validate reserved names and source boundaries before accepting
the generation. The route set grants no permission to read an authored path.

A full compilation derives the set from its actual accepted output keys. A live
metadata generation derives the same allowed set from validated entry/view
identity, document resources and the retained CSS/asset outputs, without
running unrelated render callbacks. Pending HTML can use only those declared
routes. Full background completion must agree with that generation's accepted
set before replacing its incomplete evidence.

Copy and freeze the route array and snapshot. Neither caller mutations nor
later source changes can alter a retained generation. Workers receive a private
serialized copy. They accept exactly `schemaVersion` and `routes`, the current
version, safe string paths, deterministic order and uniqueness; malformed,
unknown-version or extra-field snapshots are rejected before rendering.
Validate against the accepted configuration's generated-path contract as well.

`assertSnapshotRoutes` rejects any requested route outside that set with
`build-invalid` and the exact detail
`generated route has no accepted output validation: <route>`.
Demand, temporary Props and background workers use the same accepted snapshot;
they never derive permissions from local output or an older generation.

## No Disk Snapshot Or Reader Lock

Construction performs no output-folder listing, ownership-header scan,
generated-versus-authored collision scan or orphan detection. The generated
tree has no authored files, and replacement removes the complete previous tree.
There is no `orphanRoutes` field. Authored-source protection and collisions
inside the candidate output remain mandatory.

Snapshot capture, compilation, plain Serve, export, publication and Check never
call the output lock. The three explicit writers still hold it across the
complete transaction and revalidate the live destination at that boundary.
Keep lock ownership, dead-holder handling, cancellation and rollback tests.

## Verification

Adapt snapshot tests to prove immutable source-derived membership, rejection
outside the set, exact IPC shape and reuse of one generation across workers.
Hold another writer's lock while compiling, starting plain Serve, exporting,
publishing current-only output and checking; those operations must not wait
for it or modify it. An interrupted actual writer still stops its lock wait.

Delete a test only when its complete purpose is disk snapshot capture or a
reader lock. Record each removed/renamed title. Keep mixed-purpose tests by
replacing their setup with an accepted route set and retaining their unrelated
concurrency, cancellation, source-privacy or worker assertions.
