# Repository Verification Ratchets

## Comparison Commit

The file-length, protocol-cap, and unused-internal-export ratchets compare
with one comparison commit: `git merge-base HEAD origin/main`. During an
uncommitted merge whose `MERGE_HEAD` equals `origin/main`, the comparison
commit is `origin/main`. When `MERGE_HEAD` is an ancestor of a newer
`origin/main`, the ratchets fail and ask the author to fetch and merge it
again. Other uncommitted merges keep the merge-base rule. Outside such a
merge, a moved `origin/main` does not replace the branch point with its tip.
The [baseline dependency audit](./dependency-audit-baseline.md#comparison-commit-and-tree)
uses the same comparison commit. The public-package-export ratchet compares
with release tags instead, as [Public Package Exports](#public-package-exports)
defines.

## JavaScript And TypeScript File Length

Audit regular `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.mjs`, and `.cjs` modules
beneath the three source roots when they are added, renamed, or changed
relative to the comparison commit. The roots are `packages/mokly/src/`, which holds the shim, the sidecar,
and the authoring API;
`packages/viewer/src/`; and `scripts/`. Normalize CRLF to LF and count
LF-delimited physical lines; a final LF does not add an empty line. Deleted
files do not participate.

For a new file, the maximum is 300 lines. For an existing or Git-detected
renamed file:

- if its predecessor has at most 300 lines, the candidate must stay at most
  300;
- if its predecessor is already over 300, the candidate may stay equal or
  shrink, but any growth fails.

The repository suite also runs the changed-file
[length audit](./ci-verification-repository.md#length-audits), which fails
every changed module above 300 lines. The suite therefore fails any changed
module above 300 lines, whatever its predecessor.

A rename keeps its predecessor comparison only when Git identifies that source;
otherwise it is a new file. Build output is outside the source roots, and the
TypeScript types that the model crate generates are excluded by path, so
neither is audited. Diagnostics list candidate path, current line count,
allowed count, and predecessor when applicable. Rust files under `xtask/` and
`crates/` follow the separate 300-line audit of the
[repository gate](./ci-verification-repository.md), which has no ratchet and
no override.

## Protocol Document Caps

`xtask/protocol-document-caps.json` owns exact caps for protocol documents over
250 lines. It holds one JSON object. Each key is the path of a Markdown
document relative to `docs/protocol/`, written with `/` separators and without
an empty, `.` or `..` segment. Keys are sorted ascending by UTF-16 code unit,
and each value is a safe integer above 250. Invalid JSON, a document that is
not one object, an invalid, repeated or unsorted key, or a cap that is not a
safe integer above 250 makes the table invalid: the error names the file and
the audit fails. The ratchet also fails when the table is missing. A capped
value equals that file's current physical line count; shrinking the file
requires lowering the cap. A document at or below 250 has no cap. A new
document must stay at or below 250 and cannot add a cap. The changed-file
[length audit](./ci-verification-repository.md#length-audits) reads the same
working-tree table. The ratchet scans Markdown recursively beneath
`docs/protocol/`, excluding the `docs/protocol/fixtures/` tree, and audits
every document on every run.

The ratchet reads the baseline table at the comparison commit. When that commit
has no `xtask/protocol-document-caps.json`, each existing document over 250
lines takes its actual line count at that commit as its baseline cap. This
bootstrap cannot grant a cap to a new document.

The repository ratchet compares the candidate cap policy with the comparison
commit:

- an existing cap may stay equal, decrease, or disappear, but never increase;
- an uncapped document cannot gain a cap;
- a rename inherits its predecessor's cap, or 250 when the predecessor was
  uncapped;
- a new document has the 250-line limit.

A missing predecessor or ambiguous rename is treated as new.

## Public Package Exports

Each Release Please component identifies a public package by `package-name`,
or by the component directory's manifest name when that field is absent.
A component under the private root resolves its named public workspace package.
The root `.` component audits the CLI and viewer package surfaces together.
It maps `packages/mokly` to `@mokly/mokly` and `packages/viewer` to
`@mokly/viewer` through the shared release version.
Audit packages whose `exports` map has a JavaScript target. A platform
package exports no JavaScript and has an empty surface on both sides. Derive
each tag prefix from that package's release configuration: prepend
`<component>-` when `include-component-in-tag` is true, then append `v` when
`include-v-in-tag` is true. The shared root release retains the CLI's `v` and
the viewer's `viewer-v` histories, including their independent older versions.

Read each component entry in `.release-please-manifest.json` at `HEAD`.
For the shared viewer, use its historical entry or the root entry when absent. An
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
from the working tree, including staged, unstaged, and untracked changes. When
a package moves, resolve its tagged root by its package name in that tag's
Release Please configuration. Exactly one tagged package must match. A move
never resets its export baseline. For each side:

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
  current entry point does not export.
- A required specifier or name is noted only when
  `docs/guides/start/upgrade.md` contains a single-backtick inline code
  span on one line whose entire content is exactly that specifier or name.
  Longer signature or prose spans do not count.

The upgrade guide is the input because it holds the live upgrade steps that a
consumer follows. The changelog is not the input, because Release Please
writes it only when it cuts a release, after the removal merges.

Each failing name diagnostic identifies the full specifier, removed name, and
baseline tag, then tells the author to name the removal in
`docs/guides/start/upgrade.md`; a removed-subpath diagnostic identifies its specifier
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
- `(await import("x")).a` uses `a`. Destructured dynamic imports keep the
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
any new unused export fails. A baseline entry that is not discovered also fails
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

## Gate Placement

All four auditors are repository-suite operations and therefore run in both
`cargo xtask check --suite repository` and the unqualified complete gate. The
[repository gate](./ci-verification-repository.md#repository-boundary) gives
their place in the suite order. Every auditor runs, and each reports all of its
findings before the suite fails.
