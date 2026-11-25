# Workspace contracts cache misses the OpenAPI builds

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/ci-speed-split-workspace-checks-8lz1`.
- **Location:** `.github/workflows/ci.yml`, the `Workspace checks (Rust)` and `Workspace checks (contracts)` rows of the `check` matrix.
- **Reason:** The contracts row met its budget with the current cache. Moving a check needs a new timing comparison after a cache refresh.
- **Category:** Performance.

- **Background:** The `check` matrix of the CI workflow runs the cloud suites. `Workspace checks (Rust)` runs `cloud-rust` and saves the `cloud-rust` Rust build cache on `main`. `Workspace checks (contracts)` runs `cloud-typecheck`, `cloud-openapi`, `cloud-fixtures`, `cloud-emails`, and `cloud-origin-router`. It restores that cache and never saves it. `cloud-openapi` builds the `mkc-api` binary in the `dev` profile.
- **Problem:** Before the split, one job ran `cloud-rust` and `cloud-openapi` and saved the dependency builds of both. Now the cache writer runs only `cloud-rust`. After the next cache refresh, the cache does not hold the `dev` builds that `cloud-openapi` needs, such as `diesel_migrations` and `utoipa`. In run 45639207966, with no cache, the whole `mkc-api` build took 43.7 s after `cloud-rust`. In run 45651940353, with the current cache, the contracts row built it in 22.8 s. The added time after a refresh is not measured yet. It is at most the difference, about 21 s.
- **Impact if no action:** After a cache refresh, each contracts row builds these dependencies again, for up to about 21 s more. The row then takes at most about 4.4 min, under its 6-minute budget.
- **Root question:** How does each cloud check reuse the dependency builds that it needs, within the repository cache limit?
- **Options:**
  - **A.** On `main`, build the `mkc-api` binary in the Rust row after `cloud-rust`, only when the exact cache key missed. Effort: Small.
  - **B.** Run `cloud-openapi` in the Rust row, which writes the cache. This adds about 19 s with a cache hit to the slowest workspace row. Effort: Medium.
  - **C.** Give the contracts row its own saved cache entry. The repository cache is already above the 10 GB limit, so this evicts other entries sooner. Effort: Small.
- **Left out:** Keep the gap. It costs up to about 21 s in each contracts row until the next refresh after a lockfile change.
- **Wider fix:** None. The CI timing report already shows the row times against their budgets.
- **Recommendation:** A, after one measurement. First compare the contracts row before and after the next cache refresh, and time the extra build in the Rust row. A fills the shared entry only when it refreshes and adds no time to normal runs.
- **Action:** fix after merge, apply A.
