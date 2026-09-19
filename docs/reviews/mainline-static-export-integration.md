# Mainline Static Export Integration

The user requested merging latest main, resolving conflicts, and running another
review. Before integration, the captured source tip was `5332b6d`, main was
`a0e349a`, and their merge base was `aa5adea`. Main adds consumer static export,
static delivery and recovery safeguards, and dependency-security verification.

## Preserved Contracts

- The installed `mokabook export` command builds its consumer, includes pinned
  comparisons, and produces exact file routes and real id aliases. Its output
  reservation, destination identity checks, native non-replacing moves, validated
  backup recovery, cancellation, and primary/cleanup diagnostics remain intact.
- Current catalogues use v4 registered pages. Export includes their content and
  removed-page baseline context; current ids and routes keep precedence. Pages
  have no screen comparison controls. Historical v2/v3 reading remains confined
  to the existing Git compatibility boundary.
- Repository preview keeps its accepted default without Changes or Git history.
  Explicit Changes includes pinned comparisons and removed-entry states. It
  captures one already-built Browse generation and checks its input fingerprint
  before installation. Its supported npm command rebuilds first; the internal
  capture helper documents that precondition.
- Both publication paths share `stageExport` for ownership assembly, file/alias
  collision checks, resource validation, and deployment identity, followed by
  `ExportTransaction` for installation and cleanup. Preview retains its confined
  public-alias capture policy; consumer export retains its stricter symlink
  policy. The renderer and comparison engine are shared.
- Preview comparison generations now use content hashes, and static metadata
  addresses the immutable result directly. Default preview metadata explicitly
  disables comparisons while retaining id navigation and deployment identity.
- Main's dependency audit, package updates, lockfile, packed-consumer audits,
  browser tests, and release checks remain present. Watched-child IPC cleanup
  and the branch's complete input discovery remain intact. Test concurrency
  stays at the branch's verified limit of two workers.

## Conflict And Preservation Audit

Twelve content conflicts were resolved individually. Documentation and the plan
index retain both feature sets. Material Changes combines the captured asset
reader with v4 page attribution and historical source protection. The heading
keeps text-only collection ancestors because the approved unified-page model
removed legacy directory-overview navigation; main's exact leaf-route links
remain in the shell. Git output exclusions now accept the physical spelling of
a repository opened through a symlink without allowing outside-root paths.

All 80 files added on main remain present. The only deleted files relative to
main are the three previously approved legacy cleanup paths:

- `src/legacy/pages.ts`
- `src/server/removed_screens.ts`
- `tests/fixtures/consumers/themed/catalogue/legacy/old.source.html`

No new mainline feature, test, protocol, plan, or migration was removed. The
audit evidence is retained in `.context/main-integration-audit.json` and
`.context/main-integration-preservation.json`.

## Regression Evidence

Before replacing the old preview installer, two real capture regressions proved
that swapping an owned output for an unowned directory deleted the replacement.
They now require publication to fail and preserve the replacement contents with
Changes both enabled and disabled. Static metadata coverage first rejected the
explicit no-comparison descriptor, then passed with canonical id resolution and
strict malformed-metadata rejection retained.

Consumer export coverage includes current, removed, and renamed v4 pages and
their id aliases and ancestor context. A further regression proved that unused
reserved templates incorrectly failed public-file capture; export now uses the
shared reserved-source classifier. Imported document templates remain private
while their registered page is published normally. Existing main coverage
continues to exercise destination races, rollback conflicts, native moves,
alias collisions, source boundaries, and deployment changes.

Migration regressions also preserve prior preview artifacts with valid public
routes under `target` and `node_modules`. The adapter uses its existing public
route policy when adopting old output; the consumer command retains main's
stricter dependency/build-directory exclusions.

## Verification And Delivery

The final `cargo xtask check` passed with 740 Node tests, 117 Chromium tests,
and 4 Rust tests. It also passed formatting, ESLint, typechecking, the live
dependency audit, example freshness (70 files), package checks and packed-consumer
smokes, rustfmt, clippy, and the Rust file-length audit (10 files). Markdown
validation resolved 237 local targets across 31 changed files.

An earlier final run passed 738/740 Node tests: the real filesystem watcher
exceeded its two-second test bound, and repository preview rejected a tracked
documentation edit made during capture. Both test files passed in isolation,
then the entire gate passed with the tracked tree held unchanged. No assertion,
timeout, or production safety check was weakened. The successful full log is
`.context/main-integration-final-check-2.log`.

The preservation audit passed before and after merge commit `7dfc0bc`. Its
parents are captured source `5332b6d` and main `a0e349a`. All seven newly created
files were tracked in that commit, which was pushed before `cargo xtask review`
(pass 10/10). The review completed successfully and returned the finding below.
No further review cycle or automatic finding fix was performed.

## Review After 7dfc0bc

1. **Low — active migration guidance names an unsupported CLI command.
   Confirmed, pre-existing documentation drift.** The
   [active extraction plan](../../plans/app-independent-mokabook-library.md)
   tells future consumer cutover work to invoke `build/check/test/serve/review`
   through the installed executable. Historical migration guidance maps a
   consumer `review.cjs` script to a public `mokabook review` command and labels
   the behavior as ported. The reviewed files were unchanged from main. The
   [current command parser](../../src/cli/arguments.ts) rejects `review` and
   `test`; the supported comparison surfaces are Browse's on-demand diffs and
   static export. A direct compiled-parser probe confirmed both rejections and
   retained a passing `export --out` control. Existing
   [CLI boundary coverage](../../tests/changes.test.ts) also requires rejection
   of `review` and omission from help.

   Following the stale migration instructions could create scripts or CI jobs
   that fail immediately. This is not a merge or runtime regression.
   **A.** Align the active migration steps and inventory with the current CLI,
   link the canonical contract, and add a focused documentation guard that
   permits the removed command only in explicitly historical/removal contexts.
   Preserve the inventory's source baseline and deletion guard while updating
   its current behavior mappings. **B.** Reintroduce a standalone public Review
   command. **C.** Keep the old text and mark each stale instruction obsolete.
   **Recommended: A.** Updating only one reference leaves conflicting guidance;
   the scoped documentation guard prevents that class of drift without adding
   a product feature or treating arbitrary historical prose as runnable CLI.
   B reverses the accepted command boundary, while C leaves future cutover work
   without current instructions. No plan or inventory edit was made after this
   review, following the user's explicit rule to report new findings first.

The reviewer found no other actionable correctness, security, app-independence,
generated-output, server/watch lifecycle, comparison, or changed-document issue.
Its read-only typecheck, focused ESLint check, and committed whitespace check
passed. The complete gate had already passed before the merge commit and push;
the reviewer did not rerun commands that write build or test artifacts.
The review log is `.context/main-integration-postpush-review.log`, and the
independent CLI probe is `.context/main-integration-review-validation.log`.
