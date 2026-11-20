# The 426 message always blames the service

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `crates/mokly-cli/src/publish_errors.rs:30`, `crates/mokly-publish/src/error.rs:25`, and `docs/protocol/mokly-upload-validation.md:11-18`.
- **Reason:** The fix changes the 426 message that `docs/protocol/mokly-upload-validation.md` requires, which the user decides.

- **Source:** Review.
- **Category:** UX wording.
- **Background:**
  - A receiver answers HTTP 426 when it does not support the format versions of an upload. The CLI maps statuses by value alone and reads no rejection body, as `docs/protocol/mokly-upload-validation.md:11-18` states.
  - On every 426 the CLI prints "The catalogue service does not support this Mokly version. Update the service and try again.", from `crates/mokly-cli/src/publish_errors.rs:30` and `crates/mokly-publish/src/error.rs:25`.
  - Mokly Cloud reads upload envelope 3 and catalogue index 9 only, and it answers 426 to any other version, in `crates/mkc-mokly-contract/src/index.rs:29-36` and `crates/mkc-mokly-contract/src/error.rs:143`.
  - So an older CLI, such as 0.17.0, gets 426 from Mokly Cloud and tells its user to update the service, while the user must update Mokly. Each released CLI keeps the message that it shipped with.
- **Problem:** The 426 message names one fix, an update of the service, also when the CLI is the older side.
- **Impact if no action:** A user with an older Mokly follows wrong advice and cannot publish until someone explains the refusal. Each new release with the message adds more CLIs that give the wrong advice later.
- **Root question:** What does the CLI tell the user when the service refuses its versions?
- **Options:**
  - **A.** Keep the message. Effort: Small.
  - **B.** Change the message so that it names both fixes, for example "The catalogue service and this Mokly version do not support the same formats. Update the older of the two and try again." Update the protocol page and the tests. Effort: Small.
  - **C.** Let the receiver send the versions that it supports, and let the CLI name the older side. The CLI then reads a rejection body, which the protocol rules out today. Effort: Large.
- **Left out:** None.
- **Wider fix:** C, because the CLI then knows which side is older. B is the direct fix.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/upload-plan-index-version-status.md` adds the 426 row for an unsupported index version. Both items change the 426 rules of `docs/protocol/mokly-upload-validation.md`, so one change can carry both answers.
- **Recommendation:** B. It gives correct advice in both directions without a change at the wire. C protects the codebase best, but only for CLIs that ship after it.
- **Action:** ask the user, because B changes the 426 message that `docs/protocol/mokly-upload-validation.md:16-18` states.
