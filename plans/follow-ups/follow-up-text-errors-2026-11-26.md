# Template items and five grades hold errors

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from round 2 of the review of the branch `calummoore/builds-keep-the-template-s-compiler-and-csnm`: its list of problems outside the scope, and the wider fix of its finding 7, which the finding check found in five more items.
- **Location:** `plans/follow-ups/template-probe-pass-not-tied-to-assertion.md`, its option C; `plans/follow-ups/template-release-proves-no-comparison.md`, its **Background** line on rotations and its **Wider fix**; line 3 of `plans/follow-ups/browser-integrity-check-unmanaged.md`, `plans/follow-ups/desktop-release-misses-site-route-changes.md`, `plans/follow-ups/rollout-skips-secret-shape-checks.md`, `plans/follow-ups/marked-hidden-basename-reuse.md`, and `plans/follow-ups/variant-set-compare-capture-deadline.md`; `scripts/follow-ups.sh` and `references/follow-up-items.md` of the `plans` skill in the shared skills repository.
- **Reason:** The text predates the branch that found it, and the script lives in another repository.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Priority score:** the score from 0 to 10 that `scripts/follow-ups.sh` of the `plans` skill gives each follow-up item from the grades on its first line. It orders the open items.
- **Background:**
  - Option C of `template-probe-pass-not-tied-to-assertion.md` runs the template assertion in each build sandbox before checkout. That adds a new runner requirement to `docs/protocol/cloud/cloud-build-runner.md`. The page has 249 lines, and protocol pages are capped at 250, so the option needs a page split. The option does not say so.
  - The **Background** of `template-release-proves-no-comparison.md` says that a rotation, in "Rotate, Roll Back And Disable", runs only the probe. `docs/ops/deploy.md` also requires, on first enablement or a template or key rotation, a real build through publication with completion and sandbox cleanup.
  - The **Wider fix** of `template-release-proves-no-comparison.md` says that option D, an automated run of option C, must keep the check of the build's own publication. Option D runs Mokly's comparison on a fixture inside the candidate sandbox, and a sandbox has no publication.
  - The follow-up layout and the scales of the `decisions-and-findings` skill give a likelihood to a product bug only. The five items at line 3 under **Location** have Likelihood Rare and the category Process or Performance. The script halves the severity points of each item with Likelihood Rare, so each scores one or two points too low.
  - On 2026-11-26 the branch above fixed the same grade error in `plans/follow-ups/build-template-toolchain-has-no-guard.md`.
- **Problem:** Two template items hold an option and two statements that the code and the runbooks contradict, and five items carry a likelihood that their category does not take, which lowers their score.
- **Impact if no action:** A reader picks the probe-in-each-build option without its page split cost, misreads the rotation checks, or credits a sandbox fixture with a publication check. Five items rank lower than their grades give.
- **Root question:** How do these items state the costs and checks that the code requires, and get the score that their grades give?
- **Options:**
  - **A.** Correct the texts: add the page split to option C of `template-probe-pass-not-tied-to-assertion.md`, name the real build of `docs/ops/deploy.md` in the rotation line, say that option D checks no publication, and remove the likelihood from the five items. Effort: Small.
  - **B.** A, plus a change of the shared `plans` skill: `scripts/follow-ups.sh` halves the severity points only when the category is Product bug or the item has no category, and marks with `?` an item that has a likelihood and another category. Update the Likelihood row of `references/follow-up-items.md`. Effort: Small.
- **Left out:** Fewer than three approaches are real, because each text is right or wrong, and the grade rule is already written. Change nothing: it keeps the errors.
- **Wider fix:** B. The script stops a likelihood on another category from lowering a score, whoever writes the item.
- **Previous examples:** `plans/follow-ups/follow-up-text-errors-2026-11-22.md` holds an earlier set of text errors in follow-up items.
- **Recommendation:** B. Six items broke the likelihood rule, so the written rule alone does not hold.
- **Action:** ask the user, because B changes a tool of the shared skills repository. A can go ahead in a separate branch.
