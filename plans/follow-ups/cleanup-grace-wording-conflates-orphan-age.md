# Cleanup wording conflates two grace periods

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-31, from the privacy-retention alignment plan check and post-push review finding 1.
- **Location:** `docs/ops/environment.md:153-155`; `apps/site/src/content/legal/privacy.md:184-185`; `crates/mkc-publications/src/garbage_collection.rs:98-110`.
- **Reason:** The user deferred this work to a follow-up on 2026-11-02. It does not block the current PR.
- **Decision:** The user approved deferral, without selecting an implementation option. Keep D as the recommendation for future work.

**Terms:** An indexed object has a matching database record. An orphan object
has no matching database record.

**Background:** Daily publication maintenance collects unused stored files.
For indexed objects, its grace starts when the last publication reference is
released. For orphan objects, it checks the object's creation time because no
database record remains to give a release time.

**Problem:** The environment guide and Privacy Policy say that cleanup waits
at least 24 hours after files lose their references. The orphan sweep
instead permits deletion when the object was created at least 24 hours ago
and its exact key has no matching database row. After a database reset, an old
object can therefore be deleted by the next scheduled run. There is no new
24-hour wait from the reset.

**Impact if no action:** An operator can assume that a reset starts a new
recovery grace and delay suspending collection or restoring stored files.

**Root question:** How should operators and Privacy Policy readers learn when
cleanup can delete a file, including after a reset or restore?

**Options:**

- **A — State both clocks in both documents.** Explain the indexed release
  grace and orphan creation-age rule. Effort: Small. This duplicates the
  canonical retention rule and adds storage-record detail to public copy.
- **B — Link the guide and explain the public exception.** Link
  `docs/protocol/cloud/retention.md#reference-accounting` from the guide. Qualify the
  Privacy Policy's reference-release delay and explain orphan age. Update the
  legal-copy contract in `docs/protocol/cloud/site-legal.md` with that disclosure.
  Effort: Small.
- **C — Add a reset-based recovery delay to collection.** Persist a reset
  boundary outside the erased database and delay collection accordingly.
  Effort: Large. This changes cleanup behavior and requires a separate
  requirement decision and implementation.
- **D — Link the guide and qualify the public delay.** Use B's guide link and
  add "normally" to the policy's 24-hour statement. The policy already uses
  that qualifier for other cleanup schedules. Effort: Small. This makes the
  sentence truthful without explaining internal storage records in public
  copy; it gives less detail than B.
- **E — Give first-seen orphans a new grace.** Persist when an orphan is first
  observed and require a further 24 hours before deletion. Effort: Large. This
  needs a migration, queries, recovery semantics and a cleanup-contract
  decision.

**Recommendation:** D, replacing the initial B after the independent finding
check. It corrects the guide through the canonical rule and keeps the public
policy concise. B remains available for an explicit public explanation.

**Wider fix:** B and D use the existing documentation rule that each fact has one
home. A new lint or a prose test would not improve this correction.

**Left out:** Keeping the inaccurate sentence does not satisfy the goal.
Changing the cleanup clock is included as C rather than assumed necessary.

**Related:** The disabled-GitHub wording item also changes the environment
guide, in a separate paragraph. The edits can share a documentation change.

**Action:** Fix after merge in separate work requested by the user. Confirm
the approach when that work starts. Do not change the guide or cleanup
behavior in the current PR.
