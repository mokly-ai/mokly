# Consumer PostCSS Contexts And Evidence

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Contexts

`processCss` runs consumer PostCSS in an owned child process with `sourceRoot` as its working directory.
The core selects `repositoryRoots` and `moduleResolution` for each context.
`sourcePath` is a logical repository or dependency path. The child resolves
it against `sourceRoot` or the selected dependency root before setting PostCSS
`from`. Request labels keep the logical path. Each context and module pair has
isolated plugin state and fixed source and resolution inputs. `disposeContext`
kills and reaps only that context's process; bundle creation and disposal do not reset it.
CSS-only catalogues need no bundle. The pool tracks contexts per process and
releases disposed contexts before that process takes more work. The result
contains transformed text, resolved packages, and plugin dependencies for watching.
Class-map changes and restored JavaScript generations follow the
[bundling contract](./mokly-sidecar.md#bundling). Expected PostCSS errors carry a typed
`postcss` failure in the error envelope. Rust selects its exact code and text
from [stylesheet diagnostics](./mokly-imported-styles-errors.md).
Child startup errors, exit, IPC disconnection, and failed request writes settle
affected requests without waiting for the request deadline. Errors raised before
request attachment remain failures of that request. A failed child cannot accept
later work; a later request starts a new child for the context.
When a PostCSS request reaches its deadline, the timeout diagnostic includes
deterministic timings for child spawn, configuration load, plugin construction,
and the latest stylesheet run. Each phase reports its elapsed milliseconds or
its running state. The diagnostic does not include authored paths or CSS text.

## Read Evidence

Each result returns `readEvidence` separately from its dependency declarations.
Its coverage is always `incomplete`. Its `reads` contain `whole-file` and `byte-range` records,
with the absolute child-side path and the SHA-256 digest of the raw delivered
bytes. Its `modules` identify known module inputs, including files without
an observed read. A declaration or a module path alone is not a read witness.
Runtime builtins use runtime identity and have no invented file digest.
Each byte range retains its offset, delivered length, and any observed end of file.
Never compare a range digest with a whole-file digest or infer unread bytes.
When available, each witness retains the native identity of the descriptor
that supplied its bytes. Keep a resolved name only when its metadata matches
that open descriptor. Compare the retained identity before document callbacks
and at final installation checks. Equal bytes cannot hide a changed target.

Observe supported local compiler inputs before compilation, including JSON and
configured loaders. Preserve the original byte digest across BOM handling and
text decoding. Observe native module source buffers where the runtime exposes
them. Path-based synchronous, callback, and promise `readFile` operations record
raw bytes before delivery. Preserve encodings, errors, cancellation, and return
values. Instrumentation must not raise the supported Node minimum.
Observe descriptor and `FileHandle` reads through supported whole-file, scalar,
and vector APIs. Keep offsets through sequential reads and descriptor reuse.
Node read streams retain their raw chunk witnesses before decoding or delivery.

Keep all distinct witnessed versions for the child's context lifetime.
Keep configuration observations for later stylesheet requests. Return the
observations with the transformed CSS in the same result. Cache hits retain
that result's witnesses. Replacing or disposing a worker must not erase
witnesses attached to earlier results. Equal observations may coalesce only
after comparing their digests. Conflicting versions use the static build's
[input-change outcome](./mokly-export.md).

The core maps module evidence through the selected source and dependency roots
for each side. Base source witnesses compare with the pinned Git bytes. They
never use a head source baseline. Module evidence does not add installed packages to the catalogue
or to plugin public-file protection. Plugin read evidence uses the existing
[dependency inventory](./mokly-imported-styles-postcss.md#dependency-inventory).
Unread declarations and directory matches remain declarations, not read records.
Known readable inputs retain an explicitly late digest beside their witnesses.
A late digest cannot overwrite an observed digest. Read evidence counts toward
the existing 64 MiB PostCSS and stylesheet cache bounds and the frame bound.

## Incomplete Coverage

Native addons, helper processes, and uninstrumented workers remain compatible.
Their reads can escape observation, even when they report a dependency correctly.
This includes native scanners, memory maps, inherited or transferred handles,
and asynchronous loader workers. Such reads retain their late opaque baseline.
One JavaScript read does not prove that an opaque reader used the same bytes.
No file, plugin, or context becomes complete because a witness exists.

Untracked descriptors, unknown offsets, overlapping sequential operations, and
exotic read options retain native behavior without a guessed range witness.
Sharing a descriptor with a helper or worker makes its implicit cursor opaque.
Native descriptor APIs, native addons, and consumer workers can move cursors
without an observation. Such contexts retain late baselines for implicit reads.
An explicit position can establish a later range after a cursor becomes unknown.
FileHandle web streams retain raw witnesses without changing reader, cancellation,
or buffer-transfer behavior. Custom streams retain witnesses only for underlying observed reads.
Supported runtimes expose synchronous module customization. Ordinary transitive
ESM, CommonJS, and JSON source reads retain witnesses on the supported Node floor.
Node's private resolver reads and caches package manifests without exposing their
consumed bytes. This includes `exports`, `imports`, and package-scope metadata.
Known native manifest paths enter the late input inventory. A manifest path
does not become a byte receipt. A second resolver call or content read cannot
prove the version used by an earlier native resolution.
Unavailable native identities and unobserved resolution metadata remain incomplete.
Custom Node loaders can return transformed text. Without raw-byte provenance,
that text cannot become a whole-file witness.
Observation precedes consumer preloads. A provider that calls an observed file
API retains the underlying raw witness, even when it transforms the result.
Preserve the provider's encoding and transformed output. Generated provider
bytes and providers that bypass observed APIs have no invented raw witness.
Pre-existing or privately duplicated descriptors and caller-supplied asynchronous
`readFile` buffers can bypass the observed boundaries. They retain native behavior.
The late baseline detects only edits after capture for an unobserved input.

Decision: Mokly keeps native plugins compatible. It records a read witness
only for the reads that it observes, and it reports its coverage as
`incomplete`. Enforced immutable inputs were rejected because they need a
separate isolation and input-domain contract.

## Related Docs

- [Sidecar transport and lifecycle](./mokly-sidecar.md).
- [Static build fingerprints](./mokly-export.md).
