# Upload rejections omit the index version

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 (`calummoore/reviewjson-purpose`),
  review 2.
- **Location:** `docs/protocol/mokly-upload-validation.md:18`, the rejection
  table.
- **Reason:** Review 2 found it outside the scope of the fix commit that it
  reviewed.

The rejection table names no status for an unsupported catalogue index version
in the Plan archive. `docs/protocol/mokly-format-versions.md` requires HTTP 426
from a receiver that does not support the versions of a publication.
