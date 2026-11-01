# Share typed parent and counterpart mappings

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and its completed Rust rebuild plan, two problems outside a comparison review. The records were consolidated on 2026-11-01.
- **Location:** `crates/mokly-compare/src/projection_context.rs:24`, `crates/mokly-compare/src/review_projection.rs:75`, and `crates/mokly-compare/src/lookup.rs:139` and `:174`.
- **Reason:** The review found repeated mappings outside its change. One later branch can give both relationships the same typed owner.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Lookup:** the kind-aware branch-point lookup in `lookup.rs`, fenced to one accepted generation.
  - **Counterpart:** the base path of a current component entry after accepted moves.
  - **Pairing::paths:** a map from base paths to current paths without an entry kind.
- **Background:** The rebuild indexed Lookup and built the projection's other references on it. Lookup::counterpart proves a component's base spelling from accepted moves and base entries. Lookup::parent resolves a variant's parent with explicit side and role checks.
- **Problem:** `projection_context::Context::new` builds a separate counterparts map from pairing entries whose two sides are components. The review projection separately attaches variants through Pairing::paths. It tries the current parent, the mapped parent, and the base parent in turn. These paths repeat relationships that Lookup already answers.
- **Impact if no action:** The projection and Lookup can disagree about a moved component. A path shared by two entry kinds can attach a variant to the wrong parent.
- **Root question:** Which single typed owner should provide each entry's parent and counterpart to both consumers?
- **Options:**
  - **A.** Keep the separate maps. Document why the component projection has its own map and why variant lookup uses its fallback order. Effort: Small.
  - **B.** Build component counterparts through Lookup::counterpart and attach variants through Lookup::parent. Effort: Medium.
  - **C.** Store typed parents and counterparts once in the pairing result. Let Lookup and both projections read them. Effort: Medium.
- **Left out:** Deleting the component map without a replacement loses moved-component references. Matching variant parents by path text alone keeps the kind-less guess that causes the problem.
- **Wider fix:** C. One typed record removes both repeated mappings and keeps both consumers on the same source.
- **Previous examples:** The rebuild already replaced the projection's other references with Lookup.
- **Recommendation:** C. One typed pairing record gives Lookup and the projections the same parent and counterpart answers.
- **Action:** fix after merge, apply C, because both repeated mappings lie outside the review that found them. One branch applies the shared fix for both relationships.

The component and variant records each used A for keeping a separate map, B for reusing Lookup, and C for shared typed pairing data. Both first recommended B. Their letters retain those meanings in this combined record.

Historical source 1: [record at its source commit](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5073).

Historical source 2: [record at its source commit](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5075).
