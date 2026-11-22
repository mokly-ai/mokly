# Experiment records use an unlisted item kind

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from review round 1 of branch
  `calummoore/mokly-edit-bundle-path-kv2o`, which listed it outside the scope.
- **Location:** `plans/follow-ups/serve-head-generation-preload.md:4`,
  `plans/follow-ups/serve-postcompile-import-proof-cost.md:4`,
  `plans/follow-ups/serve-watch-candidate-plan-cost.md:4`, and
  `plans/follow-ups/serve-edit-bundle-split.md:4`: the **Kind** line of each
  record.
- **Reason:** The list of kinds is in the shared `plans` skill, outside this
  repository, and the choice has real trade-offs.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Experiment record:** a follow-up item that keeps the measurements and
    the rejected options of a bounded speed experiment that stopped, so that
    later work does not repeat them. Its **Action** says "No action".
- **Background:**
  - The follow-up template of the shared `plans` skill, in
    `templates/follow-up.md`, lists four kinds: Fix after merge, Needs
    decision, Outside the scope, and Post-merge task.
  - The four items under **Location** use the kind "Closed experiment
    record". Three came from the bounded Serve edit experiments of
    2026-11-21. The fourth, the split of the warm Serve edit bundle, follows
    them.
  - `scripts/follow-ups.sh` of the `plans` skill lists these records as open
    items, with priority scores from 3 to 5 out of 10. On 2026-11-22 it
    counted 481 open items, these four included.
  - Their measurements and rejected options are useful history for a later
    speed change.
- **Problem:** The records use a kind that the template does not define, and
  the open item count includes work that nobody plans to do.
- **Impact if no action:** Each new experiment record copies the unlisted
  kind, and the open item count and the priority list keep records that ask
  for no action.
- **Root question:** Where do the closed records of speed experiments live,
  so that they keep their facts and do not count as open work?
- **Options:**
  - **A.** Add the kind "Closed experiment record" to the template and to the
    `follow-ups.sh` script of the shared `plans` skill, and make the script
    leave that kind out of the open count. Effort: Small.
  - **B.** Move the four records to one page under `docs/`, such as a
    performance experiments page, and delete the items. Effort: Small.
  - **C.** Give each record a listed kind, Outside the scope, and keep its
    text. The open count keeps them. Effort: Small.
- **Left out:** Delete the records. Their measurements and rejected options
  would leave the repository, and a later change could repeat them.
- **Wider fix:** A. One listed kind keeps every later record correct.
- **Previous examples:** none outside these four records.
- **Recommendation:** A. It keeps the records where speed work looks first,
  and it stops them from counting as open work.
- **Action:** ask the user, because option A changes the shared `plans`
  skill, outside this repository, and options A and B differ in where the
  records live, with no option clearly best.
