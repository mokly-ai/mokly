# Repository Verification Ratchets

## Delivery Status

Implemented in Milestone 13 of the active
[id-derived routes plan](../../plans/id-derived-routes.md), from the contract
approved in Milestone 9.

This contract owns the maintainability ratchets run by the repository suite of
`cargo xtask check`. They compare the working tree, including untracked files,
with `origin/main`. CI must fetch that ref; inability to resolve it is a gate
failure, not permission to skip a check.

## TypeScript File Length

Audit regular `.ts`, `.tsx`, `.mts`, and `.cts` files beneath `src/`,
`packages/viewer/src/`, and `scripts/` when they are added, renamed, or changed
relative to `origin/main`. Normalize CRLF to LF and count LF-delimited physical
lines; a final LF does not add an empty line. Deleted files do not participate.

For a new file, the maximum is 300 lines. For an existing or Git-detected
renamed file:

- if its predecessor has at most 300 lines, the candidate must remain at most
  300;
- if its predecessor is already over 300, the candidate may stay equal or
  shrink, but any growth fails.

A rename keeps its predecessor comparison only when Git identifies that source;
otherwise it is a new file. Generated output is outside the three source roots
and therefore outside this ratchet. Diagnostics list candidate path, current
line count, allowed count, and predecessor when applicable.

## Protocol Document Caps

`tests/protocol_doc_sizes.test.ts` owns exact caps for protocol documents that
remain over 250 lines. A capped value equals that file's current physical line
count; shrinking the file requires lowering the cap. A document at or below 250
has no cap. A new document must stay at or below 250 and cannot add a cap.

The repository ratchet compares the candidate cap policy with `origin/main`:

- an existing cap may stay equal, decrease, or disappear, but never increase;
- an uncapped document cannot gain a cap;
- a rename inherits its predecessor's cap, or 250 when the predecessor was
  uncapped;
- a new document has the 250-line limit.

During the one-time introduction of the cap test, when `origin/main` has no cap
table, each existing document's baseline cap is its actual line count on
`origin/main`; renamed `mokly-variants.md` inherits
`mokly-screen-variants.md`. This bootstrap cannot grant a cap to a new document.
Later runs read the explicit table from `origin/main`. A missing predecessor or
ambiguous rename is treated as new.

## Unused Internal Exports

The auditor follows TypeScript imports and re-exports for modules beneath the
three source roots. A named export is internal when no package export-map entry
or documented public barrel exposes it. It is unused when no distinct workspace
module imports or re-exports that symbol through a statically resolvable path;
same-file references do not make the export necessary.

Known exceptions live in the reviewed, sorted
`xtask/unused-internal-exports.txt` baseline as
`<repository-relative module path>#<export name>`, one exact symbol per line,
with no globs. The discovered unused set must be a subset of that baseline:
any new unused export fails. A baseline entry no longer discovered also fails
with an instruction to delete that line, so the list can only shrink. Public
entrypoint exports, type-only exports erased from JavaScript, and test fixtures
outside the source roots are not internal-export findings. Dynamic use that a
static analyser cannot prove requires a precise reviewed baseline entry rather
than a wildcard suppression.

## Gate Placement And Evidence

All three auditors are repository-suite operations and therefore run in both
`cargo xtask check --suite repository` and the unqualified complete gate. They
run after the live dependency audit and report all findings in their own audit
before returning failure. Focused unit tests cover boundary counts, new and
renamed files, an already-oversized shrink/growth pair, cap bootstrap and stale
caps, public re-exports, newly unused symbols, and stale baseline removal.
