# Rebased partial URLs bypass the asset link rule

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 133 found.
- **Location:** `packages/mokly/src/sidecar/vite-css-hooks.ts:61`,
  `packages/mokly/src/sidecar/vite-resolution.ts:124`,
  `node_modules/vite/dist/node/chunks/node.js:31067`, and
  `docs/protocol/mokly-imported-styles-assets.md:20`.
- **Reason:** A fix that applies the link rule makes a build fail that passes
  today, and the always-on rules give each new build failure to the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Partial:** A Sass or Less file that another stylesheet imports.
  - **Rebase:** Vite's rewrite of each relative `url()` of a partial in
    another directory, so that the URL works from the root stylesheet.
- **Background:**
  - The asset contract resolves a relative URL against its stylesheet. The
    target must be a regular file inside the repository, reached without a
    symbolic link. A missing, non-regular, or escaping target fails. See
    `docs/protocol/mokly-imported-styles-assets.md:18` to line 21.
  - The base extraction omits committed symbolic links, so the base side
    cannot read a linked asset. `plans/follow-ups/base-extraction-committed-links.md`
    records that rule.
  - For a Sass or Less partial in another directory, Vite's `rebaseUrls`
    resolves each `url()` with the stylesheet resolver and writes the path
    relative to the root stylesheet
    (`node_modules/vite/dist/node/chunks/node.js:31053` to line 31067).
  - Mokly's resolver override sends that call to its stylesheet branch, at
    `packages/mokly/src/sidecar/vite-css-hooks.ts:61`. The branch returns the
    confined real path, at `packages/mokly/src/sidecar/vite-resolution.ts:124`.
- **Problem:** For a linked asset in a partial in another directory, Vite
  rewrites the `url()` to the real target. So the core checks the target, not
  the link, and it delivers a linked asset that the asset contract rejects.
  This comes from a read of the code. Nobody ran it.
- **Impact if no action:** The head side delivers the asset. The base
  extraction has no link there, so the base side fails on a missing asset,
  and Changes is not available. The head output also breaks the link rule of
  the asset contract.
- **Root question:** How does a `url()` of a Sass or Less partial keep the
  link rule of the asset contract under the Vite adapter?
- **Options:**
  - **A.** When Vite rebases a `url()` of a partial, and its resolver selects
    the real path of the authored relative target, return the authored path,
    not the real path. The core then applies its link rule and fails the
    linked asset, as for a top-level stylesheet. Test a linked asset in a
    Sass partial and in a Less partial in another directory. Cost: a build
    with such an asset fails, which passes today. Effort: Small.
  - **B.** Send each rebased `url()` through the URL rule that
    `plans/follow-ups/vite-css-url-resolution.md` decides, so that one rule
    covers the URL branch and the rebase. Its option C keeps the authored
    path for the real path of the authored target, as A does. Cost: it waits
    for that answer. Effort: Medium.
  - **C.** Accept a linked asset under the adapter, as Vite does. Deliver the
    target under the logical route of the link, and change the link rule of
    the asset contract for the adapter. Cost: the base extraction omits
    links, so the base side still fails until committed links reach the
    extraction. Effort: Medium.
- **Left out:** Change nothing. It fails the goal, because the head and the
  base give different results for the same commit.
- **Wider fix:** B. One URL rule for each place where Vite resolves a `url()`
  keeps the link rule on every path.
- **Previous examples:** `plans/follow-ups/vite-sass-outside-root-reads.md`
  records another Sass read that the adapter does not confine.
- **Related:**
  - `plans/follow-ups/vite-css-url-resolution.md`: the same resolver override
    and a shared wider fix. B waits for its answer. A agrees with each of its
    answers.
  - `plans/follow-ups/workspace-import-resolution-record.md`: same code. That
    record holds the written path of each import, which is the authored path
    that A returns.
- **Recommendation:** A. It restores the stated link rule at Small effort,
  and it agrees with each answer of the CSS URL item. Choose C only together
  with a decision to keep committed links in the base extraction.
- **Action:** ask the user, because A and B make a build fail that passes
  today, and C changes the link rule of the asset contract.
