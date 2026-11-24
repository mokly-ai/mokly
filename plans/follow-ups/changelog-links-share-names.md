# Changelog links share names across releases

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the review of `calummoore/cloud-sign-up-uadj`.
- **Location:** `apps/site/src/components/changelog/ReleaseHead.astro:52`,
  `apps/site/src/components/changelog/ReleaseCounts.astro:29`,
  `docs/guides/cli/build.md:33`.
- **Reason:** These links were on `origin/main` before the branch that found
  them, which changed only the Get started links.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Accessible name:** the label that assistive technology reads for a
    link.
- **Background:**
  - The site changelog at `/changelog` lists every release. Each release
    with a link has a **Read release details** button link to its GitHub
    release. A static scan of the build on 2026-11-24 found 23 of them on
    one page.
  - Each release also has count chips such as **Features 1**, each a link to
    the notes of its own release on the same page.
  - The guide `docs/guides/cli/build.md:33` links **Serve** to the CLI
    reference `/docs/cli/serve/`. The docs Layers tree on the same page uses
    the name **Serve** for the Getting started guide.
- **Problem:** On each of these pages, links with one accessible name open
  different targets. A screen reader's links list shows names only.
- **Impact if no action:** A reader who picks from the links list cannot
  tell the releases or the two Serve pages apart.
- **Root question:** How can each changelog and guide link name its own
  target in a links list?
- **Options:**
  - **A.** Add the version to each name: an `aria-label` such as **Read
    release details for 0.21.0** and **Features in 0.21.0, 1**. Rename the
    guide link to **the Serve reference**. Effort: Small.
  - **B.** Change nothing. The release heading and the paragraph around each
    link name its target for a reader who reads in order. WCAG 2.4.9 is
    Level AAA. Effort: Small.
- **Left out:** Fewer links, because each release needs its own details
  link.
- **Wider fix:** The page-wide rule in
  `plans/follow-ups/site-get-started-link-names.md`, option D: links on one
  page with one accessible name open one target.
- **Previous examples:** The two **Get started** names in
  `plans/follow-ups/site-get-started-link-names.md`.
- **Related:** `plans/follow-ups/site-get-started-link-names.md`, the same
  class. Its option D would fail on these links first.
- **Recommendation:** A. It names each target at a small cost.
- **Action:** fix after merge, apply A.
