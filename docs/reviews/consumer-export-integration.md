# Consumer Export: Alias Fix And Main Integration

The two code findings below were subsequently approved and implemented. The
historical review and CI results are retained; see **Approved Follow-Up** for the
changes and the [follow-up review](./consumer-export-followup.md) for passing CI
and the new unapproved recommendations.

## Approved Fix

The user approved the Medium adapter-alias finding in the
[preceding review](./consumer-static-export.md), followed by merging latest main
and creating a PR. File assembly and alias validation now share
`src/export/path_index.ts`: the same case-folded equality and directory-prefix
rules cover both kinds of route. The final ownership marker participates too.
Exact byte-identical file deduplication and distinct aliases sharing a target
remain supported. Alias collisions fail before replacing the previous site.

Thirteen regression/compatibility tests cover file/alias and alias/alias
collisions, both alias insertion orders, case folding, valid siblings, the
ownership marker, and real preview-adapter builds for routed and public pages.
Ten failed before the fix; all 28 focused alias/export/preview tests then passed.

## Mainline Preservation

Fetched main from source tip `5b143d1091c91a9deeadb43ca72034d7926d5b47`.
Its merge base was `93ac77848993bf1757eceac9387aef485823acf2`; incoming main was
`a5ecbc06d6169ec4af5329d52b6f13b2cd2f0276`. The audit covered all 50 changed or
added paths: material-output Changes filtering, resource validation/watching,
comparison diagnostics, protocols, design examples, and tests.

Two conflicts were resolved path-by-path in `src/server/watch_events.ts` and
`docs/protocol/mokly-watch.md`. Both retain main's referenced-resource reloads
and readiness lifecycle alongside inventory-aware export ignores. No mainline
files were deleted. Main's design sources/generated files, comparison changes,
resource watchers, and existing test changes are retained.

The exporter now also calls main's material-output/resource Changes calculation.
An optional reader lets that shared calculation consume the same captured public
bytes as comparisons; Serve retains its live filesystem reader. This preserves
main's ignored-only and impact-evidence exclusions while keeping linked-resource
edits visible. Three new integration tests and the updated ignored-only export
test reproduced four failures before this compatibility adjustment.

## Validation And Delivery

All 155 focused export, preview, Changes, and watch tests passed on the merged
tree, including the 16 new tests. Three full-gate attempts on this shared Mac
encountered watcher startup/update deadlines under default test-file parallelism,
on both Node 25 and the CI-aligned Node 24 runtime. Individual and sequential
watcher checks passed; a four-worker run then passed all 10 affected watch tests.
The npm test entrypoint now bounds file parallelism at four without changing
coverage, individual concurrency cases, or any timeout.

With Node 24.2.0 selected, `MOKABOOK_PLAYWRIGHT_PORT=60219 cargo xtask check`
passed all 553 unit/integration tests, 104 browser tests, packed consumers,
package/license checks, current generated-example verification, formatting,
lint, typechecking, Rust formatting/Clippy, three Rust tests, and the file-length
audit. No test failed, was cancelled, or was skipped in that complete run.

Main was fetched again after these changes and remains `a5ecbc0`. The merged
implementation was committed and pushed as `43b6de0`. Seven post-commit
static-example/Cloudflare browser smoke tests passed against that merged
baseline; mobile and desktop screenshots were inspected. The required
post-push `cargo xtask review` completed successfully on 2026-09-09 against
`origin/main` (`a5ecbc0`), with the three observations below. Its read-only audit
confirmed 99 changed files and no committed deletions.

[PR #49](https://github.com/futex-ai/mokabook/pull/49) targets `main` and is open,
not merged. No npm release was performed. PR preview deployment and Node 24 CI
passed. The first Node 22.14 CI attempt passed 552/553 unit/integration tests,
failing the existing symlink-recovery Changes-count assertion in
`tests/watch_resource_boundaries.test.ts:84`. That file and its resource-watcher
implementation are unchanged from main. Both tests in the file passed on a
focused local rerun. The
[Node 22 retry](https://github.com/futex-ai/mokabook/actions/runs/34387519308/job/102590264620)
failed at the same assertion, again with 552/553 tests passing. This is not
established as a flake, and its cause has not been isolated. The requested PR
delivery is complete, but the PR is not merge-ready: this CI failure remains
unresolved, and the two code recommendations below need a user decision.

## Post-Push Review

### 1. Medium — Deployment identity covers only comparison output

The exporter hashes `comparisonFiles` in [site.ts](../../src/export/site.ts),
then adds shell HTML, navigation, public files, CSS, modules, fonts, and adapter
output. [adoptStaticDelivery](../../packages/viewer/src/client/static_delivery.ts) uses only
`comparisonUrl` to decide whether a page belongs to the current deployment.
An independent in-memory check confirmed that changed route metadata with the
same comparison URL is adopted without a full reload.

Impact: a new export can replace shell/navigation/assets without changing the
comparison inventory. An already-open tab can then combine its old shell or
client code with a new page instead of loading the complete deployment.

Options: A) compare descriptor metadata too, which catches route-map changes but
not every asset/client change; B) add a separate deterministic deployment ID
covering the final artifact and aliases; C) always use full-page navigation.
Recommended: B, with a documented hashing/finalization contract and regressions
where comparison bytes are unchanged but shell, client, assets, or adapter
output changes. This is broader than a descriptor-only patch but protects the
whole deployment boundary while retaining progressive navigation. This was not
fixed in the reviewed snapshot; the later approved implementation is below.

### 2. Low — Preview confinement checks lexical paths only

The repository adapter in [catalogue.mjs](../../scripts/preview/catalogue.mjs)
requires the output string to sit below `.context`. The shared export path
validator enforces real repository/protected-root boundaries, but not the
adapter's narrower `.context` boundary. A symlink ancestor can therefore point
a lexically valid preview output at another allowed directory inside the repo.

Impact: preview files can be installed outside their documented scratch area.
Shared export ownership and source/root protections still apply; this finding
does not establish arbitrary external writes or unowned-directory deletion.

Options: A) enforce projected-realpath containment beneath the preview scratch
root; B) reject every symlink ancestor; C) document lexical-only confinement.
Recommended: A, reusing shared path-resolution helpers and testing ancestor
symlinks, a symlinked `.context`, and retargeting before installation. Define the
adapter boundary once so lexical and physical checks cannot drift. This retains
safe symlinks more selectively than B. This was not fixed in the reviewed
snapshot; the later approved implementation is below.

### 3. Low — Delivery bookkeeping was pending at the review snapshot

The reviewer observed unchecked review/PR closeout tasks and an active plan.
At `43b6de0`, review had not yet finished, so those pending states were accurate.
The already-planned post-review bookkeeping now records the results, closes
the requested delivery milestone, and lists the unapproved findings separately.

Impact if left pending: readers could mistake delivered work for unfinished
implementation, or assume that new recommendations had already been accepted.
Options: A) leave the original delivery active; B) complete its existing
closeout and preserve follow-up decisions in this report; C) add implementation
TODOs for the new findings immediately. Recommended: B. C would conflate
reviewer recommendations with user-approved scope. This is the previously
authorized delivery step, not an automatic implementation of new findings.

The two code follow-ups required a separate user decision at this delivery.
The later approval added milestones 10–13 without reopening completed work.

## CI Follow-Up — Not An AI Review Finding

The repeated Node 22 failure occurs after replacing an escaping symlink with a
regular file. The test waits for the first newer catalogue version and then
expects the Changes count to return to zero. The failing log does not establish
whether it observed an intermediate publication or a persistent recovery bug.

Impact: required CI remains red, so local and Node 24 success are insufficient
to treat the PR as merge-ready. Options: A) reproduce on Node 22/Linux with
version/content diagnostics, then fix the proven lifecycle or test-observation
boundary and add deterministic coverage; B) skip/relax the test; C) keep retrying
without identifying the cause. Recommended: A. If multiple valid publications
are the cause, use a shared semantic-state waiter with regression tests rather
than adding sleeps; if recovery is broken, fix the watcher itself. No test was
skipped or weakened, and no watcher change was made for this new CI issue.

## Approved Follow-Up

The user approved both code recommendations and the Node 22 investigation.

- **Deployment identity:** descriptor schema 2 carries a separate SHA-256 ID
  covering every final artifact path/byte and adapter alias edge. Finalization
  happens after adapters, reference validation, and ownership assembly. Only
  authenticated exporter-owned root descriptors are normalized for hashing and
  stamped afterward; consumer lookalikes and other bytes are retained. Old tabs
  fall back to a full document load for a different ID or an old descriptor.
  This protects shell, runtime, font, asset, and alias changes even when the
  comparison generation is unchanged.
- **Preview confinement:** one captured adapter output-root policy enforces
  both lexical and projected-realpath containment at preflight and immediately
  before installation. Safe symlinked scratch roots remain supported; ancestor
  escapes and retargeting cannot redirect an export outside the chosen scope.
- **Watcher observation:** a controlled Node 22.14/Linux removal/repair sequence
  reproduced the same failing assertion. Version 5 reported two Changes for
  the removed file; version 6 reported zero after restoration. The runtime
  recovered, but the helper had accepted the first newer publication. The
  original CI log did not record the actual intermediate count. A shared
  expected-state predicate now distinguishes unavailable Changes from zero
  while preserving the 20-second deadline. The real symlink test deliberately
  exercises that interleaving; polling regressions cover intermediate states,
  timeouts, and transport errors. No watcher runtime change or timeout increase
  was needed, and all subsequent recovery/comparison assertions remain.

Test-first evidence includes failures for complete-artifact identity, malformed
adapter shell metadata, preview scope escapes, and old-tab navigation. The
watcher reproducer failed in Linux; four deterministic test failures were then
captured locally before the shared helper fix. All 22 focused export/preview
tests, 4 delivery unit tests, 13 static/preview browser tests, and 11 watcher
tests passed after their fixes. Mobile and desktop owning-screen screenshots
retain the approved appearance. A clean Linux container using Node 22.14.0 and
npm 11.7.0 passed all 578 unit/integration tests, with none failed, skipped, or
cancelled. The initial archive transfer accidentally included macOS metadata
files; that invalid run was discarded and the complete clean run passed. The
complete Node 24.2.0 gate also passed with
`MOKABOOK_PLAYWRIGHT_PORT=62330 cargo xtask check`: all 578 unit/integration
tests, 105 browser tests, 3 Rust tests, formatting, lint, typechecking, generated
examples, package/license checks, and packed ESM/NodeNext/npx/Accounting/Juno
consumer smoke tests. The Rust file-length audit passed for all 10 files.
Main was fetched again and remains `a5ecbc0`, already contained in this branch;
the preservation audit found no mainline file deletions. The implementation was
committed and pushed as `38e0aaa` before `cargo xtask review`. Required CI passed
on both supported runtimes. The [follow-up review](./consumer-export-followup.md)
records the final results and two new independently checked recommendations.
