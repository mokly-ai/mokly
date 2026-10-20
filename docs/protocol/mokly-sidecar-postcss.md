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

## Read Evidence

Each result returns `readEvidence` separately from its dependency declarations.
Its coverage is always `incomplete`. Its `reads` contain `whole-file` records,
with the absolute child-side path and the SHA-256 digest of the raw delivered
bytes. Its `modules` identify known module inputs, including files without
an observed read. A declaration or a module path alone is not a read witness.
Runtime builtins use runtime identity and have no invented file digest.

Observe supported local compiler inputs before compilation, including JSON and
configured loaders. Preserve the original byte digest across BOM handling and
text decoding. Observe native module source buffers where the runtime exposes
them. Path-based synchronous, callback, and promise `readFile` operations record
raw bytes before delivery. Preserve encodings, errors, cancellation, and return
values. Instrumentation must not raise the supported Node minimum.

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
One JavaScript read does not prove that an opaque reader used the same bytes.
No file, plugin, or context becomes complete because a witness exists.

Descriptor reads, `FileHandle` reads, streams, and partial ranges remain opaque
in this stage. Exotic read options retain native behavior without a witness.
Older Node runtimes without synchronous module customization retain ordinary
file observation and local compiler witnesses. Unobserved transitive ESM loads,
private resolution metadata, and read-time path identity remain incomplete.
Custom Node loaders can return transformed text. Without raw-byte provenance,
that text cannot become a whole-file witness.
Preloaded code can replace file APIs before observation starts. Such contexts
keep late baselines for those APIs and compiler reads, even when they return buffers.
The late baseline detects only edits after capture for an unobserved input.

Decision 56 selects staged observation to preserve plugin compatibility.
Enforced immutable inputs need a separate isolation and input-domain contract.
This stage does not meet the full M14 consumed-byte requirement.

## Related Docs

- [Sidecar transport and lifecycle](./mokly-sidecar.md).
- [Static build fingerprints](./mokly-export.md).
