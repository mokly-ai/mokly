# Serve edits keep a superseded peer package

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-28, from review round 2 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, the wider fix E of
  finding 305.
- **Location:** `packages/mokly/src/sidecar/paths.ts:53`, the `lookup` of
  `consumerRequire`. `docs/protocol/mokly-sidecar-recipes.md:171` and
  `docs/protocol/mokly-watch.md:174`, the Serve edit omission.
- **Reason:** The fix changes the Serve edit reuse rule for peer packages
  that are already on the primary branch, so it needs a user decision.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Peer package:** a package that the sidecar loads at render time, such
    as React, `@storybook/react`, or `@emotion/cache`.
  - **Serve edit compile:** a fast compile in Serve that keeps only part of
    the full resolution evidence and can be reused while its recorded inputs
    match.
- **Background:**
  - The sidecar resolves each peer package by search order. Outside a full
    capture, each lookup keeps only its result.
  - Finding 305 of the branch above fixed this for the Storybook framework
    fallback: the absent candidates of the direct `@storybook/react` lookup
    are now inputs of the selection.
  - The other peers and the fallback's own manifest and framework lookups
    still keep only their results in a Serve edit compile.
- **Problem:** A peer package that appears earlier in the search order, for
  example a new direct install, does not end reuse of a Serve edit compile.
- **Impact if no action:** Serve can render with the old peer until another
  recorded input changes or Serve restarts.
- **Root question:** How does a reused Serve compile keep using the peer
  package that has priority in the current installation?
- **Options:**
  - **A.** Keep the Serve edit omission and state the limit in the guide.
    Effort: Small.
  - **B.** Record the candidates of every lookup of `consumerRequire`, and of
    `resolveReact`, as live inputs on both compilers. Change the Serve edit
    omission in both protocol pages. Effort: Medium.
- **Left out:** A check of every peer at each reuse: it adds an esbuild
  resolve to each reuse, which the recipe decision rejected.
- **Wider fix:** B, because one recorder serves every peer lookup.
- **Previous examples:** Finding 305 of the branch above.
- **Recommendation:** B. Serve then never keeps a superseded peer.
- **Action:** ask the user, because B changes the Serve edit omission for
  peers that are already on the primary branch.
