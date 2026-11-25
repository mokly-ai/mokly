# Testbox npm cache contradicts the cache rule

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-actions-cache-headroom-and-gi6l`, review list of problems outside the scope.
- **Location:** `.github/workflows/blacksmith-testbox.yml` (the second "Set up Node.js" step, `cache: npm`), `docs/protocol/ci-verification-security.md` (the paragraph that starts "Workflows other than CI use no npm cache"), `docs/protocol/remote-verification-testbox.md` (step 3 of the Testbox job).
- **Reason:** The mismatch predates the branch that found it, and that branch changed only the Rust cache key of the Testbox job.

- **Terms:**
  - **Testbox:** A Blacksmith runner that runs the remote gate. Its workflow is `.github/workflows/blacksmith-testbox.yml`. Blacksmith runners keep their workflow caches in Blacksmith's own store, not in the Actions cache of the repository.
  - **`setup-node` cache:** The npm download cache that `actions/setup-node` restores and saves itself when its `cache` input is set.
- **Background:** The security doc says that workflows other than CI use no npm cache, and that only runs on `main` save a cache. The Testbox doc says that the job installs Node 22.15.0 "with the root lockfile cache and `package-manager-cache: false`". The workflow sets `cache: npm` on that step, so `setup-node` restores and saves the npm cache.
- **Problem:** The two protocol pages disagree. The `setup-node` cache saves on any branch that runs the Testbox workflow, also a pull request branch, which the `main`-only save rule forbids. On Blacksmith runners the entry goes to Blacksmith's store, so it does not count against the 10 GB Actions cache of the repository.
- **Impact if no action:** A reader cannot tell which rule holds. If the job ever moves to a GitHub-hosted runner, branch entries would count against the 10 GB limit and could evict `main` entries.
- **Root question:** Which npm cache rule holds for the Testbox job?
- **Options:**
  - **A.** Keep the Testbox npm cache. Add to the security doc that the Testbox job keeps an npm cache in the Blacksmith store, which every branch can save. Effort: Small.
  - **B.** Remove `cache: npm` from the Testbox step, and change step 3 of the Testbox doc. Each box then downloads its npm packages. Effort: Small.
  - **C.** Keep the cache, and save it only from `main`, with a separate `actions/cache/restore` and `save` pair, as CI does. Effort: Small.
- **Left out:** None. These three cover keeping, dropping, and narrowing the cache.
- **Wider fix:** None. The `main`-only save rule already covers the class.
- **Previous examples:** Commit `5dc54988b` turned off the built-in `setup-node` cache of `desktop-release.yml` for the same rule.
- **Recommendation:** C. It keeps the box install fast and makes the rule the same for every workflow.
- **Action:** ask the user, because each option changes a requirement in a protocol doc.
