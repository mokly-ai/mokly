# Retention protocol restores implementation mechanics

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the post-push retention review and the independent check of finding 5.
- **Location:** `docs/protocol/cloud/retention.md:126`; `docs/protocol/cloud/retention.md:155`.
- **Reason:** The user deferred this work to a follow-up on 2026-11-02. It does not block the current PR.
- **Decision:** The user approved deferral, without selecting an implementation option. Keep C as the recommendation for future work. Its new requirement still needs approval before implementation.

**Terms:** A protocol document records required behavior and decisions at a
system boundary. `pg_constraint` is the Postgres table that records foreign
keys.

**Background:** The documentation rule puts requirements in protocol docs,
implementation mechanics in code comments, and code entry points in crate
READMEs. The user approved this placement rule on 2026-10-20.

**Problem:** The retention protocol describes partial indexes, query-plan
tests, foreign-key discovery, fixture population and direct expiry calls.
These describe the test and query implementation. Commit `3989436d` removed
substantially the same text during documentation alignment. The retention
change restores it.

The test module comments, `crates/mkc-store-pg/README.md` and
`docs/ops/publish-smoke.md` already explain these details. The Verification
list also claims stalled-continuation coverage that the tests do not provide.
The independent collection-continuation cases also remain untested.

**Impact if no action:** Query or test refactors can leave the protocol stale
while required behavior stays correct. The duplicated case list can overstate
test coverage.

**Root question:** Where should maintainers find retention requirements and
the details of their implementation?

**Options:**

- **A — Move the mechanics beside the code.** Keep useful entry-point links
  in crate READMEs and preserve protocol requirements. Existing comments and
  guides already describe the mechanics, so moving the text can duplicate
  them. Effort: Small.
- **B — Remove duplicated implementation narrative.** Keep the requirements
  and link to existing crate documentation. Remove the Verification case
  list. This adds no new requirement. Effort: Small.
- **C — State the selection-cost requirement.** Replace the index and
  query-plan sentences with a requirement that selection cost does not grow
  with successful publication history. Remove the Verification section.
  Keep eligibility before the limit and child retain-or-delete requirements.
  This keeps the cost intent without choosing an index implementation.
  The user must approve the new requirement. Effort: Small.

**Recommendation:** C, replacing the first pass's A after the independent
check. Successful history can grow without an age limit. Each maintenance run
has a ten-minute deadline. C states the boundary property that the existing
query-plan test protects. B is the fallback without a new requirement.

**Wider fix:** The documentation skill already sets the home of each fact.
The merge skill already requires review of changes that override main. No
additional prose lint or test is needed.

**Previous examples:** Commit `3989436d` removed this implementation narrative.
`plans/follow-ups/docs-added-after-audit-keep-code-names.md` concerns later
protocol additions. That item does not cover this restored text.

**Left out:** A separate protocol page keeps mechanics in the wrong place.
README and runbook summaries already exist. The implementation plan already
records the work history. Prose tests violate the testing rule. Leaving the
text unchanged reverses the approved documentation cleanup.

**Related:**
`plans/follow-ups/cleanup-grace-wording-conflates-orphan-age.md` and
`plans/follow-ups/disabled-github-copy-includes-cleanup-settings.md` share the
documentation rule. Their fixes do not conflict with this item.
`plans/follow-ups/gc-continuations-lack-independent-regressions.md` and
`plans/follow-ups/storage-cursor-stall-is-not-tested.md` show the coverage
overstatement. Removing the protocol case list keeps those test fixes
independent of this document.

**Action:** Fix after merge in separate work requested by the user. Confirm
the approach and any new requirement when that work starts. Do not change
the protocol, queries or tests in the current PR.
