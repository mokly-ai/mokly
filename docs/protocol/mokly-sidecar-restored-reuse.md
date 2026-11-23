# Sidecar Restored Reuse

A restored generation is one that a successful `restoreGeneration` request
installed in a sidecar process. A `restoreGeneration` request for an id that the
process already holds changes nothing, also when a `bundle` request installed
that id. A restored generation ends with a successful `dispose` of its id, with
a successful `bundle` result that returns its id, or with its process.

When the reuse checks of a `bundle` request accept the compilation of a restored
generation of its process, the result is short:
`{ generation, restoredGeneration }`. `restoredGeneration` names that restored
generation. `generation` names the new lifetime, and the two ids can be equal.
When the frame limit rules change the full result, such as by dropping the reuse
evidence, the result is full. Every other `bundle` result is full, such as a
fresh compile or the reuse of a generation that a `bundle` request installed.
Decision: a short result names a compilation that the core already holds. A
cheaper encoding of the full result was rejected, because it keeps the transfer
and the decode. A short result without the size check was rejected, because a
restore alone does not prove that the full result fits.

The core reads a short result as the full result with the exact `compiled` value
and module graph of that restored generation, and no `plan`. Its
`unmappedDependencyDirectories` are those of that `compiled` value, or an empty
list when it has none. The core recomputes no member from current files. Every
rule that reads a full result treats a short result in the same way, such as the
stored plan of a [warm start](./mokly-sidecar-plans.md#warm-start). So a short
result changes no output, warning, diagnostic, or error.

The core resolves `restoredGeneration` against the restored generations that the
process held before the request. A short result that names no such restored
generation is a malformed frame, so it fails with `sidecar-protocol`. The core
resolves short results only from recipe data that it already holds. Short
results add no decoded copy and no retained recipe data to the core.
