# Protocol symbol test checks only two names

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from finding 6 of review 2 in the Milestone 12 review TODO of the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/_tests_/protocol-symbols.test.ts:15-20` and `apps/app/README.md`.
- **Reason:** PR #51 merged on 2026-10-21 with the finding open for the user. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. The test still reads the four protocol docs and still checks two names, `follow()` and `workspaceRole()`. It does not read the README.
- **Category:** Test.

- **Terms:**
  - **Protocol symbol test:** `apps/app/src/_tests_/protocol-symbols.test.ts`, which requires each backticked name in four protocol docs to exist in `apps/app/src`.
  - **Key Code section:** The `### Key Code` list of a README that names the entry points of an area.
- **Background:** The test reads `auth-callbacks.md`, `web-app.md`, `web-product-shell.md` and `viewer.md` under `docs/protocol/cloud`. It fails when one of them names a symbol that the app does not declare. PR #51 moved code names out of the protocol docs into the READMEs. So these four docs now name few app symbols. At commit `f568853e` the test still checks `follow()` and `workspaceRole()`, and it exempts `back()`.
- **Problem:** The test still reads the protocol docs, so it checks only two names. The `apps/app` README now holds the code names that the test was meant to protect.
- **Impact if no action:** A README entry can name a removed symbol, and no test fails. The test costs run time and protects only two names.
- **Root question:** How does a stale app symbol name in the docs fail a check?
- **Options:**
  - **A.** Point the test at the Key Code section of `apps/app/README.md`. The `testing` skill keeps doc prose out of tests, so this needs the user's policy choice. Effort: Small.
  - **B.** Delete the test, because the protocol docs name little code. It removes the check of `follow()` and `workspaceRole()`, which the docs still name. Effort: Small.
  - **C.** Keep the test as it is. It still protects the two names that the protocol docs hold, and the README stays unchecked. Effort: Small.
- **Left out:** A check of every README in the repository. That is the wider fix in `plans/follow-ups/key-code-names-have-no-existence-check.md`.
- **Wider fix:** The repository-wide Key Code check in `plans/follow-ups/key-code-names-have-no-existence-check.md`. It is a new gate, so it waits for the user.
- **Previous examples:** Finding 4 of the same review found another check that the moved code names left without input.
- **Related:** `plans/follow-ups/key-code-names-have-no-existence-check.md`, shared wider fix.
- **Recommendation:** A. It keeps the protection where the names now live.
- **Action:** ask the user, because condition 6 holds: the finding concerns a test, a category that the review-fix rule does not let an agent fix alone.

On 2026-10-31 the four docs held two checked names, `follow()` and `workspaceRole()`, and the exempt `back()`. Count them again before the fix. Only when the count is zero do A and B leave the same protection on the protocol docs.

Source: [the Milestone 12 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L673-L702) of the deleted plan.
