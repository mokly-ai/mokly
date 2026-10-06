# Plans

Rules for the implementation plan files under `plans/`. A plan records the
work needed to align the implementation with the protocol docs, its
milestones, and its TODOs. [`AGENTS.md`](../../AGENTS.md) holds the always-on
rule to tick TODOs as you complete them; this document holds the rest.

- Plans should only be created with consent from the user and after the relevant
  protocol docs provide enough context to plan the work safely
- Plans do not live at the repo root anymore; they live under `./plans`
- Create one plan file per change, named after the change in concise kebab-case, for example `tool-request-error-contract-alignment.md`
- Do not combine unrelated work into a shared plan file; create a new plan file for each distinct change
- There is no plans index file. Each plan records its own status in the first
  paragraph directly below its title. That paragraph starts with
  `Status: Active` while the plan is open, or with `Status: Completed` when it
  is closed. List the open plans with `grep -l '^Status: Active' plans/*.md`
- When creating a new plan file, start it with a `Status: Active` paragraph
- When a plan's PR merges, change its status paragraph to start with the
  text below, and keep any open review findings or follow-up owners in that
  paragraph:

  ```text
  Status: Completed. [PR #<number>](<url>) merged on <YYYY-MM-DD>.
  ```

- Each plan describes work needed to ensure complete alignment with the protocol docs
- The PR merge is the completion boundary for a plan. Every milestone and its
  required TODOs must be completable on the branch before the PR merges or by
  the merge itself. Never add a milestone or required TODO that depends on the
  PR already being merged.
- Put post-merge work, including additional tasks and smoke tests that require
  the merged or deployed change, in a `## Post-merge follow-up (non-blocking)`
  section outside the milestones. Items in this section do not affect
  milestone or plan completion and must not prevent the plan from being marked
  completed when the PR merges.
- Keep smoke tests that can and should run before merge as required milestone
  TODOs under the normal testing rules.
- Each plan should break up the work into concrete units called Milestones. At the end of each milestone there should be a functioning product. Never leave the code base or feature in a broken state.
- The first milestone in every plan must update the relevant documentation and
  protocol/spec documents so they define the complete contract for the work
  that follows.
- When a plan requires mockup work, its second milestone must be the initial
  mockup milestone, immediately after the documentation and protocol/spec
  milestone. Include all mockup work known during initial planning in that
  single milestone. Additional mockup milestones may be added later when a
  genuine mockup gap is discovered during implementation; do not add
  speculative duplicate mockup milestones during initial planning.
- Each plan must end with a review TODO after its commit-and-push TODO. The
  review TODO must direct a reviewer to use
  `docs/implementation-review-prompt.md` against `origin/main` after the push,
  to report findings, and then to apply the review-fix rule in [`review.md`](./review.md):
  fix the `Auto-fix: yes` findings, re-review once, and report the
  rest.
  Read existing plan review TODOs that say "without changing the
  implementation" under the same rule.
- When a plan includes backend changes, mockup or design updates, and UI
  implementation, keep each area in its own milestone. Mockup/design work and
  UI implementation must be separate milestones, with mockups completed before
  UI implementation begins. Do not combine backend, mockup/design, or UI
  implementation tasks in the same milestone.
- Milestones that include UI or mockup work must include an explicit tag line
  immediately below the milestone heading: `Tags: ui` or `Tags: mockup`. A
  milestone tagged `ui` or `mockup` must not include backend work. If backend
  work is found to be missing while implementing a `ui` or `mockup` milestone,
  always create new milestones; never add the backend work to the current
  milestone, never add it to an existing milestone, and never move the blocked
  UI/mockup TODOs into an existing milestone. First create a new backend
  milestone immediately after the current milestone for the required backend
  work. Then create a new tagged UI/mockup milestone immediately after that
  backend milestone and move the blocked UI/mockup TODOs there, preserving their
  incomplete status.
- Milestones should have a short summary of what it includes
- All milestones have TODO checklists, lists of tasks that must be completed to achieve the milestone.
- Any time a new TODO is discovered during implementation, it should be added under the relevant milestone (just add the new TODO, and then continue with the active TODO)
- If a TODO is complex, break it down into sub-tasks/TODOs
- As you complete items, you should tick them off in the relevant file under `./plans`
- Do not put evidence logs in plan files. Evidence logs show how work was
  checked: command output, test and gate results or timings, smoke-test
  output, search results, audit and preservation records, test-title
  inventories, and full reviewer reports. Save them under
  `.context/<plan-name>/`, which Git ignores. Under the related milestone, add
  one line that names the file. A plan keeps only its summary, milestones,
  TODOs, contracts, decisions, user approvals, and short review summaries.
  Agents read the whole plan, so logs in a plan slow every session.
- The workspace `README.md` should link to the `plans/` directory, not to an individual plan file unless a specific change needs to be referenced
- Mark a milestone as completed when all the tasks are completed, do not re-open existing milestones - create a new milestone if new tasks are needed that do not fit into an existing milestone
