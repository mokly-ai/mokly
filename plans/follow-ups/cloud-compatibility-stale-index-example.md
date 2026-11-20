# Compatibility doc cites an obsolete index example

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the post-push re-review of PR #379, on `calummoore/fu-receiver-read-model-validation-prd6`.
- **Location:** `docs/protocol/cloud/mokly-artifact-compatibility.md:12`, the example of a prose page that disagrees with the format inventory. Its target is `docs/protocol/mokly-shell-delivery.md:67`.
- **Reason:** The obsolete example predates the receiver content check and is outside that implementation.
- **Category:** Docs or spec.

- **Terms:**
  - **Catalogue index:** The public JSON at `mokly-viewer/index.json` that lists catalogue entries and comparison results.
- **Background:** Mokly Cloud consumes the public catalogue artifacts of Mokly. The compatibility page makes the format inventory, generated declarations, and public readers authoritative for format versions. It requires catalogue index version 9.
- **Problem:** The page cites `schemaVersion: 8` in the shell delivery page as an example of a conflicting prose version. That target now states `schemaVersion: 9`. The claimed disagreement no longer exists. The example is also present on `origin/main` at `525b4d7e5`.
- **Impact if no action:** Readers can look for an obsolete format conflict and doubt which current document is correct. The receiver already requires index 9.
- **Root question:** How should the compatibility page state its version authority without an obsolete example?
- **Options:**
  - **A.** Remove or replace the obsolete example. Keep the existing format-authority rule and index-9 requirement. This corrects a false citation without changing the wire contract. Effort: Small.
- **Left out:**
  - Changing only the example number to 9 still claims a disagreement where none exists.
  - Changing the accepted wire version changes a correct requirement and does not repair the citation.
  - Only a factual correction is needed. Broader code changes or a new documentation gate do not meet this item's goal.
- **Wider fix:** None. The documentation skill already requires code and protocol documents to stay aligned.
- **Previous examples:** None found for this citation. The follow-up search found no existing item that owns it.
- **Recommendation:** A. It preserves the current contract and removes the false example.
- **Action:** fix after merge, apply A, because this pre-existing documentation issue is outside the receiver validation task.
