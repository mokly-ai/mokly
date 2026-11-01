# Output JSON files use two-space indentation

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from decision 4 of the closed "Index and Ownership
  File Sizes" workspace of 2026-10-27, measured again on 2026-11-01.
- **Location:** `crates/mokly-model/src/canonical.rs:46`,
  `crates/mokly-model/src/output/artifact.rs:61`, and
  `docs/protocol/mokly-catalogue-serialization.md:23`.
- **Reason:** The fix changes a rule of the serialization protocol page, and
  the user has not chosen an option.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Catalogue index:** the file `mokly-viewer/index.json`. The Browse
    shell fetches it at every page load.
  - **Entry detail:** the JSON file for each entry under
    `mokly-viewer/entries/`. The viewer fetches it when a reader opens the
    entry.
  - **Ownership marker:** the file `.mokly-export-artifact`, which lists
    every output file with its path, SHA-256 digest, and size.
- **Background:**
  - `to_string` in `crates/mokly-model/src/canonical.rs:46` writes the
    index and the details with two-space indentation. The marker uses the
    same form, in `crates/mokly-model/src/output/artifact.rs:61`.
  - `docs/protocol/mokly-catalogue-serialization.md:23` requires two-space
    indentation and a final LF. Readers ignore whitespace.
  - On 2026-11-01, `main` at `c553bd6f` built `examples/basic`. Compact
    JSON would give these sizes, as estimated with a JSON re-encode:
    - Index: 2,092,783 bytes to 1,272,600. With gzip, 126,588 to 73,125.
    - 240 details: 14,533,718 bytes to 6,379,683. With gzip, 1,112,068 to
      686,634.
    - Marker: 637,388 bytes to 556,387.
  - Each detail id is a hash of the detail's canonical JSON, at
    `crates/mokly-model/src/canonical.rs:56`. So every detail id and every
    detail's bytes change one time, and the next publish uploads every
    detail again.
- **Problem:** Indentation is 39% of the index bytes and 56% of the detail
  bytes.
- **Impact if no action:** Hosts send larger files, also with gzip, and
  `build` holds larger files in memory.
- **Root question:** Which JSON form gives the smallest output files and
  still gives identical bytes for identical inputs?
- **Options:**
  - **A.** Keep the indentation, so that the output stays easy to read.
    Effort: Small.
  - **B.** Write compact JSON for the index, the details, and the marker,
    and update the serialization page. Effort: Small (estimate).
  - **C.** B for the index and the details only. No browser fetches the
    marker. Effort: Small (estimate).
- **Left out:** Rely on gzip alone. The compact form is still about 40%
  smaller after gzip, and `build` memory holds the raw bytes.
- **Wider fix:** B. One canonical form then serves every JSON output.
- **Previous examples:** None found.
- **Related:**
  - [variant-prop-schema-copies.md](./variant-prop-schema-copies.md): with
    both changes the example index is 528,842 bytes.
- **Recommendation:** B. A two-line code change makes the index about 40%
  smaller and the details about 56% smaller.
- **Action:** ask the user, because option B changes the indentation rule
  of the serialization protocol page.
