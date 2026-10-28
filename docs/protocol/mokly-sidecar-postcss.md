# Consumer PostCSS Contexts And Evidence

## Contexts

`processCss` runs consumer PostCSS in an owned child process with `sourceRoot` as its working directory.
The core selects `repositoryRoots` and `moduleResolution` for each context.
`sourcePath` is a logical repository or dependency path. The child resolves
it against `sourceRoot` or the selected dependency root before setting PostCSS
`from`. Request labels keep the logical path. Each context and module pair has
isolated plugin state and fixed source and resolution inputs. `disposeContext`
kills and reaps only that context's process; bundle creation and disposal do not reset it.
CSS-only catalogues need no bundle. The result
contains transformed text, resolved packages, and plugin dependencies for watching.
Class-map changes and restored JavaScript generations follow the
[bundling contract](./mokly-sidecar.md#bundling). Expected PostCSS errors carry a typed
`postcss` failure in the error envelope. The core selects its exact code and text
from [stylesheet diagnostics](./mokly-imported-styles-errors.md).
Child startup errors, exit, IPC disconnection, and failed request writes settle
affected requests without waiting for the request deadline. Errors raised before
request attachment remain failures of that request. A failed child cannot accept
later work; a later request starts a new child for the context.
When a PostCSS request reaches its deadline, the timeout diagnostic includes
deterministic timings for child spawn, configuration load, plugin construction,
and the latest stylesheet run. Each phase reports its elapsed milliseconds or
its running state. A running timeout also names the last module URL observed by
the child. The diagnostic does not include authored CSS text.

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
that open descriptor. Equal bytes cannot hide a changed target.

A digest covers the raw bytes before BOM handling and text decoding.
Observation preserves the encodings, errors, cancellation, and return values
of the observed reads. It does not raise the supported Node minimum.

A result returns its observations with the transformed CSS. It keeps every
distinct witnessed version of the current generation, including configuration
reads of earlier stylesheet requests in that generation. A new generation
drops the witnesses of earlier generations. A reused result keeps its
witnesses, also after its worker is replaced or disposed. Conflicting versions
use the static build's [input-change outcome](./mokly-export.md).

The core maps module evidence through the selected source and dependency roots
for each side. Base source witnesses compare with the pinned Git bytes. They
never use a head source baseline. Module evidence does not add installed packages to the catalogue
or to plugin public-file protection. Plugin read evidence uses the
[dependency inventory](./mokly-imported-styles-postcss.md#dependency-inventory).
Unread declarations and directory matches remain declarations, not read records.
Known readable inputs retain an explicitly late digest beside their witnesses.
A late digest cannot overwrite an observed digest. Read evidence counts toward
the 64 MiB PostCSS and stylesheet cache bounds and the frame bound.

## Incomplete Coverage

Native addons, helper processes, and uninstrumented workers remain compatible.
Their reads can escape observation, even when they report a dependency
correctly. A read that Mokly cannot observe keeps its native behavior and gets
no guessed or invented witness. Known inputs retain their late opaque
baseline, which detects only edits after capture. One JavaScript read does not
prove that an opaque reader used the same bytes. No file, plugin, or context
becomes complete because a witness exists.

File modules supplied by consumer module hooks retain their resolved paths,
including when a hook supplies a module without delegating. Their bytes remain
opaque without raw provenance. Modules that Node loads in its asynchronous
loader thread, such as the modules that define asynchronous hooks, have no
module path. They have no late baseline unless another input report names
their paths. Decision: Mokly observes module paths only on the main thread. A
loader-thread observer was rejected, because main-thread observation already
reports every module that PostCSS code loads, and a loader-thread observer adds
work to each module resolution.

Decision: Mokly keeps native plugins compatible. It records a read witness
only for the reads that it observes, and it reports its coverage as
`incomplete`. Enforced immutable inputs were rejected because they need a
separate isolation and input-domain contract.

## Related Docs

- [Sidecar transport and lifecycle](./mokly-sidecar.md).
- [Static build fingerprints](./mokly-export.md).
