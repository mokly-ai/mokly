# A zero-prefix deny rule blocks all IPv4

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from a finding check of review round 1 of branch `calummoore/e2b-build-enabling-vbbo`.
- **Location:** `crates/mkc-config/src/builds.rs:88-108`, `infra/scripts/build_values.py:53-63`.
- **Reason:** The behaviour comes before that branch, which did not change these lines.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Deny rule:** an IP or CIDR that a build sandbox must not reach, set through `deniedDestinations`.
- **Background:** Canonicalization masks host bits, so an operator rule such as `1.2.3.4/0` becomes `0.0.0.0/0`. E2B accepts that rule, and it denies every IPv4 destination, including the API upload origin that `docs/ops/build-template.md` says builds must reach.
- **Problem:** A typing mistake in one deny rule makes every build fail its upload.
- **Impact if no action:** Every build of that environment fails until an operator finds the rule.
- **Root question:** How does a configured deny list keep the build's required destinations reachable?
- **Options:**
  - **A.** Document that a `/0` rule denies all traffic of that family. Effort: Small.
  - **B.** Reject a deny rule with prefix length 0 in the renderer and in `mkc-config`, with a regression. Effort: Small.
  - **C.** Reject a deny list that covers the configured API upload origin. Effort: Medium.
- **Left out:** None.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Related:** `build-deny-rules-e2b-rejects.md` adds validation in the same places.
- **Recommendation:** B, decided together with `build-deny-rules-e2b-rejects.md`.
- **Action:** ask the user, because B adds a configuration rejection.
