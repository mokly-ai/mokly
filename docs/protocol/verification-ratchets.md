# Repository Verification Ratchets

## Delivery Status

Implemented in Milestone 13 of the active
[id-derived routes plan](../../plans/id-derived-routes.md), from the contract
approved in Milestone 9.

This contract owns the maintainability ratchets run by the repository suite of
`cargo xtask check`. Every ratchet resolves one comparison commit with
`git merge-base HEAD origin/main`, then compares the working tree, including
untracked files, with the tree or policy at that commit. The tip of
`origin/main` is never the comparison tree. CI must fetch the ref and enough
history to resolve the merge base; failure to do either fails the gate.

## JavaScript And TypeScript File Length

Audit regular `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.mjs`, and `.cjs` modules
beneath `src/`, `packages/viewer/src/`, and `scripts/` when they are added,
renamed, or changed relative to the comparison commit. Normalize CRLF to LF and
count LF-delimited physical lines; a final LF does not add an empty line.
Deleted files do not participate.

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
Both that test and the ratchet scan Markdown recursively beneath
`docs/protocol/`, excluding the `docs/protocol/fixtures/` tree.

The repository ratchet compares the candidate cap policy with the comparison
commit:

- an existing cap may stay equal, decrease, or disappear, but never increase;
- an uncapped document cannot gain a cap;
- a rename inherits its predecessor's cap, or 250 when the predecessor was
  uncapped;
- a new document has the 250-line limit.

During the one-time introduction of the cap test, when the comparison commit
has no cap table, each existing document's baseline cap is its actual line
count at that commit; renamed `mokly-variants.md` inherits
`mokly-screen-variants.md`. This bootstrap cannot grant a cap to a new document.
Later runs read the explicit table from the comparison commit. A missing
predecessor or ambiguous rename is treated as new.

## Unused Internal Exports

The auditor follows imports and re-exports across `.ts`, `.tsx`, `.mts`, `.cts`,
`.js`, `.mjs`, and `.cjs` modules beneath the three source roots. A named export
is internal when no package export-map entry or documented public barrel
exposes it. It is unused when no distinct workspace module imports or
re-exports that symbol through a statically resolvable path; same-file
references do not make the export necessary. Static CommonJS assignments
through `exports.name`, `module.exports.name`, and object-literal
`module.exports` participate as named exports.

Known exceptions live in the reviewed, sorted
`xtask/unused-internal-exports.txt` baseline as
`<repository-relative module path>#<export name>`, one exact symbol per line,
with no globs. The discovered unused set must be a subset of that baseline:
any new unused export fails. A baseline entry no longer discovered also fails
with an instruction to delete that line. The candidate baseline must also be a
subset of the baseline stored at the comparison commit: any entry absent there
fails even when the current scan discovers it. These two checks make the list
shrink-only across the branch. If the comparison commit predates the baseline
file itself, the candidate list is the one-time bootstrap; every entry must
still be discovered, and the comparison-commit rule applies after that file
lands. Public entrypoint exports, type-only exports erased from JavaScript, and
test fixtures outside the source roots are not internal-export findings.
Dynamic use that a static analyser cannot prove requires a precise reviewed
baseline entry rather than a wildcard suppression.

## Gate Placement And Evidence

All three auditors are repository-suite operations and therefore run in both
`cargo xtask check --suite repository` and the unqualified complete gate. They
run after the live dependency audit and report all findings in their own audit
before returning failure. Focused unit tests cover boundary counts, new and
renamed files, an already-oversized shrink/growth pair, cap bootstrap and stale
caps, nested protocol documents and the fixtures exclusion, public re-exports,
newly unused symbols, attempted baseline growth, stale baseline removal, and a
moving `origin/main` whose merge base stays fixed.
