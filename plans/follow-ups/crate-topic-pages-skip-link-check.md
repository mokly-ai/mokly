# Crate topic pages skip the link check

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from track D of the Storybook support plan, pull
  request #493, which split `crates/mokly-graph/README.md` into topic pages.
- **Location:** `tests/markdown_links.test.ts:22-30`,
  `crates/mokly-graph/cache.md`, `crates/mokly-graph/delivery.md`,
  `crates/mokly-graph/rendering.md`, `crates/mokly-graph/workers.md`,
  `crates/mokly-server/background.md`, and `crates/mokly-server/delivery.md`.
- **Reason:** The fix adds files to a check, which is stricter validation,
  and the user approves each new check.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Topic page:** a Markdown file beside a crate's `README.md` that holds
    one part of a long README, such as `crates/mokly-graph/rendering.md`.
  - **Link check:** the test `tests/markdown_links.test.ts`, which resolves
    each local link and anchor of the files that it selects.
- **Background:**
  - The link check selects `AGENTS.md`, every file under `docs/` and
    `plans/`, every file named `README.md`, and every Markdown file under
    the cloud license paths. Lines 22 to 30 hold this filter.
  - A crate README that passes 300 lines moves parts into topic pages beside
    it. `crates/mokly-graph` has `cache.md`, `delivery.md`, `rendering.md`,
    and `workers.md`. `crates/mokly-server` has `background.md` and
    `delivery.md`.
  - None of these topic pages is named `README.md`, and none is under
    `docs/` or a cloud path. So the link check reads none of them.
  - On 2026-11-24, track D checked the 82 local links of the five
    `mokly-graph` pages by hand, and each one resolved.
- **Problem:** A broken link or anchor in a crate topic page passes every
  check.
- **Impact if no action:** A rename or a moved heading can break a link in a
  topic page, and no test reports it.
- **Root question:** How does the link check cover every Markdown page that
  documents a crate?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Select every Markdown file under `crates/` in the link check.
    Effort: Small.
  - **C.** Select each Markdown file that a selected file links, so the
    check follows the links from each README to its topic pages. Effort:
    Medium.
- **Left out:** Fold the topic pages back into each README: the 300-line
  rule for READMEs splits them on purpose.
- **Wider fix:** B, because it covers each new topic page without a change
  to the test.
- **Previous examples:** The topic pages `crates/mokly-graph/cache.md` and
  `crates/mokly-server/background.md`, which predate this item.
- **Recommendation:** B. One path rule covers every crate page, and the
  pages pass today.
- **Action:** ask the user, because B adds files to a check, which is
  stricter validation.
