# Move CI timing mechanics out of the protocol

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F20 review of 2026-10-21.
- **Location:** `docs/protocol/ci-test-timing.md:44-47` and
  `docs/protocol/ci-test-timing.md:68`.
- **Reason:** The review found the problem in a protocol page that its
  change did not edit, so the fix needs a separate docs branch.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Protocol page:** a page under `docs/protocol/` that states the
    requirements and decisions in force, not implementation details.
  - **Duration helper:** `tests/helpers/durations.ts`, the one test module
    that reads elapsed time and reports it as text.
- **Background:**
  - `docs/protocol/ci-test-timing.md` is the timing contract for the Node,
    browser, and Rust tests.
  - The `documentation` skill puts implementation mechanics, such as file
    and function names, in a README or in the code.
  - On 2026-10-21 a review found two parts of the page that named test
    helper files and functions. The duration helper section named
    `reportDuration` and `startDuration`. The fixture budget sentence named
    `tests/helpers/fixture_timing.ts` and the fixtures that use the
    isolated budget.
  - Commit `89c12ef1` of PR #218, on 2026-10-27, removed most of this. The
    function names and the fixture list left the page.
    `tests/browser/README.md:235-238` now names `fixture_timing.ts`.
- **Problem:** The page still names the duration helper by its path twice.
  The Duration Reporting section, at lines 44-47, names it as the only
  module that subtracts clock reads. The ESLint Guard section, at line 68,
  names it as the only file that the lint exempts.
- **Impact if no action:** A rename of the helper makes the protocol page
  stale. The page keeps a file path that the documentation rules put
  elsewhere. The rule itself stays correct.
- **Root question:** Must the timing contract name the one module that may
  read elapsed time, or only state the rule?
- **Options:**
  - **A.** Change nothing, and delete this item. The path stays, because it
    makes the lint exemption exact. Effort: Small.
  - **B.** State the rule without the path, for example "one shared
    duration helper". Keep the path in the code, where `eslint.config.js:92`
    exempts the file and the lint message at line 100 names it. Add the
    path to `docs/development/README.md` when a reader needs it. Effort:
    Small.
- **Left out:** Delete the exemption rule from the page. It removes the
  requirement that only one module subtracts clock reads. Fewer than three
  approaches exist, because the only choice is where the path lives.
- **Wider fix:** None. The `documentation` skill rule is already in force,
  and the documentation audit of PR #218 applied it to this page.
- **Previous examples:** Commit `89c12ef1` of PR #218 moved mechanics out of
  many protocol pages.
- **Related:** [html-screens-implementation-detail.md](html-screens-implementation-detail.md)
  records the same class on another protocol page. One docs branch can fix
  both, and each item stays valid alone.
- **Recommendation:** B. The path is a mechanic, and the lint
  configuration already holds it.
- **Action:** fix after merge, apply B, because the content is
  implementation detail that moves to its home, and the page is outside
  the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4118).
