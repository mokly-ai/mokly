# Variants repeat the parent's prop schema

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from decisions 1 and 3 of the closed "Index and
  Ownership File Sizes" workspace of 2026-10-27, measured again on
  2026-11-01.
- **Location:** `crates/mokly-model/src/projection_records.rs:62`,
  `packages/viewer/src/catalogue/detail_fences.ts:167`, and
  `docs/protocol/mokly-format-versions.md:7`.
- **Reason:** The fix changes the catalogue index format, and the user has
  not chosen an option.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Catalogue index:** the file `mokly-viewer/index.json`. The Browse
    shell fetches and parses it at every page load.
  - **Variant:** an entry that renders with its parent's code and a
    different saved set of props.
  - **Prop schema:** the `propSchema` field of a screen or component
    record. The viewer uses it to check and edit props.
- **Background:**
  - `visual` in `crates/mokly-model/src/projection_records.rs:62` writes
    `propSchema`, `props`, and `controls` into every screen, component,
    and variant record of the index.
  - On 2026-11-01, `main` at `c553bd6f` built `examples/basic`. The index
    was 2,092,783 bytes, 126,588 bytes with gzip. All 85 variants, of 25
    parents, had the same prop schema and `controls` as their parent.
  - Without those variant copies the index is 985,133 bytes, 80,039 bytes
    with gzip.
  - The example's design library sets `destination` to an `enum` of all 130
    design paths, in `examples/basic/specs/design/library/schemas.ts:26`.
    The index holds 144 copies of it, and most sit in variant schemas. The
    enum lets TypeScript check each destination path that an author
    writes, so the example keeps it.
  - The viewer already checks each detail against the parent schemas of the
    index, in `packages/viewer/src/catalogue/detail_fences.ts:167`.
  - Release 0.18.0 shipped index version 9. A format change needs index
    version 10, and Mokly Cloud must adopt the new reader.
- **Problem:** The index stores each prop schema once for the parent and
  once more for each variant. Here the copies are 53% of the index.
- **Impact if no action:** Each variant adds another schema copy to a file
  that every page load fetches and parses.
- **Root question:** How does the viewer get a variant's prop schema
  without a second copy of it in the index?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Leave out `propSchema` and `controls` on a variant when they
    equal the parent's. Readers take them from the parent. It needs index
    version 10, the Rust writer, the viewer reader, and the Mokly Cloud
    reader. Effort: Large.
  - **C.** Move `propSchema`, `props`, and `controls` from the index to the
    entry details. The detail check of the viewer then needs another
    source for the parent schemas. Effort: Large.
- **Left out:** Change the example's `destination` enum to a plain string.
  It shrinks only this example, and authors lose the TypeScript check of
  destination paths.
- **Wider fix:** B. No variant then repeats an equal schema in any
  catalogue.
- **Previous examples:** PR #223 kept a component's usage lists only in its
  parent detail, the same class of copy in the entry details.
- **Related:**
  - [compact-json-output.md](./compact-json-output.md): with both changes
    the example index is 528,842 bytes.
  - [skip-equal-before-snapshots.md](./skip-equal-before-snapshots.md): it
    also needs a new index number. One release can carry both.
  - [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md): Mokly Cloud must
    adopt each new index version.
- **Recommendation:** B. It removes the copies with the smallest format
  change, and the detail check already uses only parent schemas.
- **Action:** ask the user, because option B changes the catalogue index
  format and its protocol pages.
