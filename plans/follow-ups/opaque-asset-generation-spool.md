# Share an opaque-asset spool for each generation

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: the post-merge task of user decision 61 and M14 review 6, finding 5.
- **Location:** `crates/mokly-server/src/asset_streams.rs:21`,
  `crates/mokly-server/src/backend.rs:123`, and
  `docs/protocol/mokly-imported-styles-assets.md:84`.
- **Reason:** On 2026-10-20 the user chose one private capture for each
  request and deferred the shared spool without approving it.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Opaque asset:** a file that a stylesheet references, such as an image
    or a font, that Mokly delivers by route without decoding it.
  - **Generation:** one immutable render state of Serve. In watched Serve, a
    source edit creates a new generation.
  - **Spool:** a temporary file that holds a verified copy of an asset for
    delivery.
- **Background:** Serve delivers an opaque asset as follows.
  - Serve answers `GET` and `HEAD` for
    `/static/mokly-generated/assets/{route}` with the bytes of the current
    generation.
  - The generation keeps the route, the path, and the SHA-256 digest of each
    asset, not its bytes.
  - Before Serve sends headers, it checks the complete asset against that
    digest and its opened length. A mismatch fails the request, and watched
    Serve then requests a new generation.
  - `docs/protocol/mokly-imported-styles-assets.md` states these rules from
    line 84.
  - `GraphDocuments::asset` in `crates/mokly-server/src/backend.rs` opens the
    asset for each request.
  - `TemporaryAssets::capture` in `crates/mokly-server/src/asset_streams.rs`
    copies and checks the full asset into a new unnamed temporary file. That
    file closes with its response.
  - On 2026-10-20 the user chose option A, one private capture for each
    request, as the interim design. The decision recorded that
    `docs/protocol/mokly-imported-styles-assets.md` documents its bound, and
    it deferred the shared spool to after the merge.
  - The rebuild asked that the spool decision use the large-project Serve
    budgets. It must account for `GET` and `HEAD` capture work, live response
    files after worker permits end, and operating system temporary storage
    outside process RSS.
- **Problem:** Each `GET` and each `HEAD` of one asset repeats the full copy
  and the digest work. Each concurrent response holds its own temporary file.
- **Impact if no action:** A page that loads many assets repeats the copy and
  the digest for each request. Temporary storage grows with the number of
  open responses, outside the memory that Serve measures.
- **Root question:** How should Serve deliver a verified asset of one
  generation without a full copy and check for each request?
- **Options:**
  - **A.** Keep one private verified capture for each request. This is the
    interim design that the user chose on 2026-10-20. Effort: Small.
  - **B.** Share one verified spool for each generation and route. The
    first request copies and checks the asset. Later requests of that
    generation read the spool. The spool is released with its generation.
    Account for `GET` and `HEAD` capture work, for response files that stay
    open after a worker permit ends, and for temporary storage outside
    process memory. Keep the large-catalogue budgets of
    `docs/protocol/mokly-timings.md`, section Budgets. Update the delivery
    rule of the asset page in the same change, because a request after the
    first reads the spool, not the source. Effort: Medium.
  - **C.** Share one verified copy only among concurrent requests for one
    generation and route, and close it after the last response. A later
    request copies and checks the asset again. Disk use never grows past
    the current design. Effort: Medium.
- **Left out:** A stream from the source that checks the digest after the
  bytes leave breaks the rule that Serve checks the asset before it sends
  headers. A copy in process memory adds the full size of each large asset
  to Serve's memory.
- **Wider fix:** B. One store that the generation owns removes the repeated
  copy for every asset route.
- **Previous examples:** The large-project work of the Rust rebuild made
  opaque assets digest-only inputs. The generation keeps the route, the path,
  and the digest. Delivery streams and checks the bytes.
- **Related:**
  [git-opaque-asset-batching.md](./git-opaque-asset-batching.md) concerns
  the base side of the same assets: one Git process for each digest and a
  buffered copy during delivery. The two items change different code and can
  land in either order.
- **Recommendation:** B. It removes the repeated copies for the
  life of a generation, and the rebuild kept A only as the interim design. C
  is the smaller step if the measured disk use of B is too high.
- **Action:** ask the user, because B changes the delivery rule of
  `docs/protocol/mokly-imported-styles-assets.md`, and no user decision approves
  that change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5426).
