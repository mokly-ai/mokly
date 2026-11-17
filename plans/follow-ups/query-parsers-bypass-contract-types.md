# Query parsers bypass the contract parameter types

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the unchecked post-merge task of the deleted `plans/openapi-from-rust.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/pagination.rs:14-36`, `crates/mkc-api/src/endpoints.rs:209-220`, `crates/mkc-api/src/viewer/input.rs:39-92` and `crates/mkc-api/src/contract/parameters.rs:33-53`.
- **Reason:** The OpenAPI change of PR #49 recorded it as post-merge work, so it merged on 2026-10-20 without it.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `Pagination`, the slug suggestion parser and the viewer `Query` still parse by hand, beside the dead-code `Cursor` and `Limit` types. No actual query mismatch is known.
- **Category:** Code structure.

- **Terms:**
  - **`IntoParams` struct:** A `utoipa` type that describes query or header parameters for the generated OpenAPI document.
  - **Contract stub:** A function under `crates/mkc-api/src/contract/` that carries one operation's OpenAPI attributes.
- **Background:** Rust owns the API contract. `utoipa` generates `docs/api/openapi.json` from the contract stubs, and the app client is generated from that file. The `cursor` and `limit` query parameters are declared as `IntoParams` structs in `crates/mkc-api/src/contract/parameters.rs:33-53`. Those structs carry `#[expect(dead_code)]`, because no parser uses them.
- **Problem:** The runtime parses query strings by hand. `Pagination::parse` reads `cursor` and `limit`. `query_values` in `endpoints.rs` feeds the slug suggestion queries. The viewer `Query::parse` reads the viewer queries. So the document and the parser describe the same parameters with two types, and a change to one does not fail the other. No actual mismatch is known today.
- **Impact if no action:** A parameter can drift between the document and the parser, and the generated client then sends a query that the API refuses. Each new list operation copies the hand-written pattern.
- **Root question:** How do the query parser and the OpenAPI document share one definition of each query?
- **Options:**
  - **A.** Parse each query into its `IntoParams` struct, so the parser and the document share one type. Keep `validation-failed` for unknown and repeated keys, and keep the cursor and limit behaviour, so no validation gets stricter. It touches at least four modules, so it can pass the five-file band of Medium. Effort: Medium.
  - **B.** Keep the hand parsers and add a test that compares each parser's accepted keys with the document. It is a detection fix. Effort: Medium.
- **Left out:** Change nothing. The drift class stays open, and the dead-code stubs stay.
- **Wider fix:** A. One type per query removes the class.
- **Previous examples:** `LogQuery` in `crates/mkc-api/src/builds/input.rs:63-102` already derives `IntoParams` and parses into the same struct. `crates/mkc-api/src/github/listing_input.rs:9-34` parses the installation list query by hand.
- **Related:** `plans/follow-ups/follow-up-list-hides-item-choices.md` names this task as an earlier example of work outside the follow-up list.
- **Recommendation:** A. It follows the precedent of `LogQuery` and removes the dead-code stubs.
- **Action:** ask the user, because condition 6 holds: the item is about code structure, and the post-merge note of PR #49 chose no design. The first action was "fix after merge, apply A". Its reason was that the change that created the stubs kept the behaviour and left the parser change for later.

Source: [the post-merge task](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/openapi-from-rust.md?plain=1#L312-L317) of the deleted plan.
