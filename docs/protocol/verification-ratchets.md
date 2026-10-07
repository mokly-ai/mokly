# Repository Verification Ratchets

## Delivery Status

The file-length, protocol-cap, unused-internal-export, and
public-package-export ratchets are implemented. Every ratchet in this document
runs in the repository suite and the complete gate. The baseline dependency
audit uses the same comparison-commit resolver.

This contract owns the maintainability ratchets run by the repository suite of
`cargo xtask check`. The file-length, protocol-cap, and unused-internal-export
ratchets resolve one comparison commit with
`git merge-base HEAD origin/main`, then compare the working tree, including
untracked files, with the tree or policy at that commit. Outside an uncommitted
merge, the tip of `origin/main` is never their comparison tree. The
public-package-export ratchet
is the sole exception: it compares with release tags reachable from `HEAD` and
never uses the merge base. CI must fetch `origin/main`, enough history to
resolve the merge base, and release tags; failure to obtain required history or
refs fails the applicable gate.
While a merge is uncommitted, use `MERGE_HEAD` only if it equals `origin/main`.
If it is an ancestor of `origin/main`, main moved during the merge and the
gate fails until the merge is refreshed. For any other merge, including a
local `main` ahead of `origin/main`, retain the normal merge-base rule. The
source-file-length audit uses the same Git comparison boundary. The
[baseline dependency audit](./dependency-audit-baseline.md) also shares this
comparison-commit rule through `GitWorkspace.requireBase()`.

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
The changed-file source-length audit and this ratchet share one length policy:
TypeScript/JavaScript have a 300-line limit; a changed protocol page passes at
250 lines or at its exact reviewed cap, never above it.
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

## Public Package Exports

The published packages are exactly the paths under `packages` in
`release-please-config.json`; currently `.` (`@mokly/mokly`) and
`packages/viewer` (`@mokly/viewer`). Derive each tag prefix from that package's
release configuration: prepend `<component>-` when
`include-component-in-tag` is true, then append `v` when
`include-v-in-tag` is true. The current prefixes are therefore `v` and
`viewer-v`.

Read the package path's entry in `.release-please-manifest.json` at `HEAD`. An
absent entry or the exact version `0.0.0` means that package has never been
released, so skip it. For every released package, the baseline is the newest
tag matching `<prefix>[0-9]*` that is reachable from `HEAD`, equivalent to:

```bash
git describe --tags --abbrev=0 --match '<prefix>[0-9]*' HEAD
```

Do not fall back to the merge base or an unreachable tag. If a released
package has no matching reachable tag, fail closed and tell the author to run
`git fetch --tags origin` before retrying.

The released surface comes from the baseline tag; the current surface comes
from the working tree, including staged, unstaged, and untracked changes. For
each side:

1. Read that side's `<package root>/package.json` and include every key in its
   `exports` map, including non-JavaScript exports.
2. Recursively visit each export-map target. Ignore a target under the `types`
   condition and any string that does not end in `.js`, `.mjs`, or `.cjs`.
3. Map each JavaScript target the same way as the unused-export ratchet: remove
   its leading `./dist/` and final `.js`, `.mjs`, or `.cjs`, so
   `./dist/<path>.js` becomes `<package root>/src/<path>`, then resolve the first
   file that exists on that side with `.ts`, `.tsx`, `.mts`, `.cts`, `.js`,
   `.mjs`, or `.cjs`, in that order. Read baseline sources from the tag and
   current sources from the working tree. A JavaScript target that cannot map
   to a source entry point is a finding.

Every mapped source contributes its expanded exported names to that subpath.
Direct names come from named export lists with or without `from`, including
type-only lists; exported variable, function, class, interface, type, enum, and
namespace declarations; `export * as ns from`, which exports `ns`; and every
`export default` form, which exports `default`. Aliases contribute the public
exported name.

Relative `export * from` and `export type * from` declarations expand
recursively on the same side using the unused-export resolver's module
candidates. Each contributes the target's expanded names except `default`;
nested stars and cycles are supported. A star with a package specifier or no
resolvable source target on that side is a finding.

Compare the released and current surfaces as follows:

- If a baseline subpath is absent now, require its full public specifier: the
  package name for `.`, otherwise `<package>/<subpath>` with the leading `./`
  removed. Its individual names need no separate notes.
- For each surviving subpath, require every baseline exported name that the
  current entry point no longer exports.
- A required specifier or name is noted only when
  `docs/protocol/npm-release-notes.md` contains a single-backtick inline code
  span on one line whose entire content is exactly that specifier or name.
  Longer signature or prose spans do not count.

Each failing name diagnostic identifies the full specifier, removed name, and
baseline tag, then tells the author to name the removal in
`npm-release-notes.md`; a removed-subpath diagnostic identifies its specifier
and baseline tag with the same instruction. The passing summary lists every
package baseline tag and the total number of noted name and subpath removals.

An export added and then removed after the latest release tag needs no note. A
note may be deleted only after history contains the release tag that published
that removal; until then, the same reachable baseline still reports it.

## Unused Internal Exports

The auditor follows imports and re-exports across `.ts`, `.tsx`, `.mts`, `.cts`,
`.js`, `.mjs`, and `.cjs` modules beneath the three source roots. A named export
is internal when no package export-map entry or documented public barrel
exposes it. It is unused when no distinct workspace module imports or
re-exports that symbol through a statically resolvable path; same-file
references do not make the export necessary. Static CommonJS assignments
through `exports.name`, `module.exports.name`, and object-literal
`module.exports` participate as named exports.

A CommonJS `require` call is a call of an identifier named `require` with
exactly one string-literal argument. This deliberately includes a
`createRequire` result bound to the name `require`. A non-literal specifier is
not resolved; an export left unused only because of such a call needs one exact
reviewed baseline entry.

Import use is recorded by these rules:

- `const { a, b: c } = require("x")` uses exports `a` and `b`;
  `require("x").a` and `require("x")["a"]` use `a`; a bare
  `require("x");` uses no export.
- Binding the complete module object uses every export. This covers
  `const x = require("x")`, `import x = require("x")`, and
  `const x = await import("x")`.
- `(await import("x")).a` uses `a`. Destructured dynamic imports retain the
  named rule: aliases use the property name, as in
  `const { a, b: c } = await import("x")` using `a` and `b`.
- A default import uses every export when its resolved target is a CommonJS
  module and uses none when the target is an ES module. A target is CommonJS
  when its source extension is `.cjs` or `.cts`, or when it contains a
  recognized static assignment through `exports.name`, `module.exports.name`,
  or an object-literal `module.exports` assignment.

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

All four auditors are repository-suite operations and therefore run in both
`cargo xtask check --suite repository` and the unqualified complete gate. They
run after the live dependency audit and report all findings in their own audit
before returning failure. Focused unit tests cover boundary counts, new and
renamed files, an already-oversized shrink/growth pair, cap bootstrap and stale
caps, nested protocol documents and the fixtures exclusion, public re-exports,
newly unused symbols, CommonJS use, attempted baseline growth, stale baseline
removal, release-tag selection, public name and subpath removals, explicit
exports, recursive star re-exports, unresolved star targets, release-note
retention, and a moving `origin/main` whose merge base stays fixed.

The approved [API and member checks](./verification-api-members.md) add public
signature reports with a release-note gate, an unused-member ratchet and a test
for literal ESLint paths. Existing export-name and size checks remain independent.
