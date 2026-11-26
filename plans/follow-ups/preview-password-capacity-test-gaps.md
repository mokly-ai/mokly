# Preview password capacity tests miss two cases

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the review of the fix that bounds the preview password queue on the branch `calummoore/preview-password-sign-in-jofl`.
- **Location:** `crates/mkc-api/src/_tests_/preview_capacity_tests.rs:33`, `crates/mkc-api/src/_tests_/preview_capacity_tests.rs:46-76`, `crates/mkc-api/src/preview_dispatch.rs:55-89`, `crates/mkc-api/src/dispatch.rs:116-126`.
- **Reason:** The branch used its two review fix rounds, and both gaps are test coverage of behaviour that the code already has.

- **Category:** Test.
- **Terms:**
  - **Place:** one of the ten places that each API process has for preview password attempts at `POST /v1/auth/preview`: two checks run at once and eight more attempts wait. A full queue answers 503 `unavailable` before per-IP admission.
- **Background:**
  - `crates/mkc-api/src/preview_dispatch.rs` reserves a place with `try_acquire_owned` after the gate, the Origin check (`dispatch.rs:116-120`), the body check and the password length check (`preview_dispatch.rs:55`), and before admission. The place is an owned permit that moves into the blocking check closure, so a running check keeps its place after its caller disconnects, while a waiting attempt frees its place when its request is dropped.
  - `preview_capacity_tests.rs` fills the queue by holding both check permits from the test itself, so no check runs while the queue is full, and it sends only valid attempts while the queue is full.
- **Problem:** Two plausible regressions pass every test:
  - Dropping the place when the check permit arrives (after `preview_dispatch.rs:87`), or writing `let _ = self.place;` (which in edition 2024 does not move the place into the closure). More than ten attempts can then be in flight, or a dropped request frees the place of a running check.
  - Moving the reservation above the length check or above the Origin check. A full queue then answers 503 where the protocol requires 403 `csrf-rejected` or 400 `validation-failed`.
- **Impact if no action:** A later change can silently loosen the bound on concurrent password work or change the order of refusals that `docs/protocol/cloud/preview-sign-in.md` (Password Exchange) defines.
- **Root question:** How do the tests prove that a running check keeps its place and that the place comes after the request checks?
- **Options:**
  - **A.** Add two cases to `preview_capacity_tests.rs`. First, an `AuthenticatorMock::preview` check that signals it started and then blocks on a channel; run two attempts into it on a runtime with three blocking threads, fill the other eight places, and assert that the next attempt gets 503 `unavailable` both before and after one running request is dropped. Second, while all ten places are held, send a wrong Origin and an empty password, and assert 403 `csrf-rejected`, 400 `validation-failed`, and no change to the admission count. Use event order and the existing 30-second expected-state bound. Effort: Small.
- **Left out:** A property test over every await point, because two direct cases cover the two named regressions.
- **Wider fix:** None, because these are direct coverage gaps of one exchange.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the branch used its two review fix rounds.
