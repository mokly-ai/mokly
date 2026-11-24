# The site's brand files copy token colours

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the review of the branch `calummoore/favicons-app-icons-new-logo-jbsc`, a problem outside its scope.
- **Location:** `apps/site/public/brand/*.svg`, `apps/site/tests/brand_assets.test.ts`, `docs/protocol/cloud/design-tokens.md` (section "Ownership And Application"), `packages/tokens/README.md`.
- **Reason:** The contradiction is already on `origin/main`, and resolving it changes a protocol requirement, which the user decides.
- **Category:** Docs or spec.

- **Terms:**
  - **Design tokens:** The shared design values that `@mokly-cloud/tokens` (`packages/tokens`) owns.
- **Background:** The site publishes downloadable brand files, `mokly-icon*.svg` and `mokly-logo*.svg`, under `apps/site/public/brand/`. They are self-contained SVGs with literal token colours, because a downloaded image cannot read custom properties. `apps/site/tests/brand_assets.test.ts` checks that each file holds the expected token colours. `docs/protocol/cloud/design-tokens.md` says that the catalogue, the application and the site import the token package and none keeps a copy; `packages/tokens/README.md` says no consumer copies a value. The contract records an exception for emails only.
- **Problem:** The committed brand files contradict the token ownership rule, and the contract records no exception for them.
- **Impact if no action:** The contract keeps saying something the code does not do.
- **Root question:** Which committed outputs may hold literal token values?
- **Options:**
  - **A.** Extend the contract's exception to every output that cannot read custom properties and that a test ties to the token tables: the emails, the brand files, and the app favicon. Effort: Small.
  - **B.** Generate the brand files from the token tables at site build time and stop committing them. Effort: Medium.
- **Left out:** None.
- **Wider fix:** A states the class rule.
- **Related:** `plans/follow-ups/app-favicon-copies-token-colours.md`, the same rule and the app's favicon; its option E is A here, and one answer settles both.
- **Recommendation:** A. The files already have a colour check, so the rule's reason, no drift, holds.
- **Action:** ask the user, because the recommended option changes a protocol requirement with no recorded user decision.
