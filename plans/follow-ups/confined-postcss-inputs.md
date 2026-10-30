# Confine opaque PostCSS inputs

- **Severity:** High. **Likelihood:** Rare (estimate). **Effort:** Small.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 114, decided on 2026-10-21.
- **Location:** `docs/protocol/mokly-sidecar-postcss.md:75-98`, and the read
  observers in `packages/mokly/src/sidecar/postcss-evidence.ts` and
  `packages/mokly/src/sidecar/postcss-read-*.ts`.
- **Reason:** On 2026-10-21 the user accepted the observed-read guarantee
  for the merge and moved the confined input design to work after it.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Read evidence:** the files and byte ranges that PostCSS code read
    through observed Node APIs, each with a digest of the delivered bytes.
  - **Late baseline:** a digest of a known input that Mokly takes after the
    read. It detects only edits made after that capture.
  - **Opaque read:** a read that Mokly cannot observe, so it has no witness
    of the bytes that the reader used.
- **Background:**
  - Mokly runs the consumer's PostCSS plugins in the sidecar. It records
    read evidence, so that a static build can detect inputs that changed
    during the build.
  - On 2026-10-19 the user approved observed-read evidence in stages. It
    keeps explicit incomplete coverage and late opaque baselines, and it
    keeps native plugins compatible. The rejected options were enforced
    immutable inputs and further deferral.
  - `docs/protocol/mokly-sidecar-postcss.md:75-98` states the result.
    Coverage is always `incomplete`. Enforced immutable inputs were rejected,
    because they need a separate isolation and input-domain contract.
  - The open question was whether to close the evidence work with this
    guarantee or keep it open until a confined design covers opaque reads.
    The plan graded it High, because native reads can still produce CSS from
    bytes that differ from their late baseline.
  - The user's decision of 2026-10-21 closed the work with the observed-read
    guarantee and moved the confined input design to this item.
  - The plan named an earlier design draft under `.context/` of the rebuild
    workspace. That draft is not in the repository.
- **Problem:** These reads stay opaque: native addons, helper processes,
  workers, metadata reads, `fs.openAsBlob`, and WASI. Their cases are native,
  helper, and worker reads, private resolution metadata, unknown descriptor
  positions, opaque providers and options, and unavailable native identity.
- **Impact if no action:** A plugin that reads through one of these paths
  can produce CSS from bytes that no witness records. A change in a short
  window can then give a build with stale CSS and no input-change error.
- **Root question:** How can Mokly know the exact bytes that an opaque
  PostCSS reader used?
- **Options:**
  - **A.** Keep the observed-read guarantee and its recorded incomplete
    coverage, and delete this item. Effort: Small.
  - **B.** Write the confined input design. Cover each opaque read class
    above. Compare enforced immutable inputs, where PostCSS reads a pinned
    copy of its input domain, with a platform sandbox that denies reads
    outside that domain. Bring the design's decisions to the user before any
    code changes. The design changes no code. Its later implementation is
    Large (estimate). Effort: Small.
  - **C.** Implement enforced immutable inputs without a design first. It
    adds a new protocol contract and isolation on every platform. Effort:
    Large.
- **Left out:** Reject native addons, helper processes, and workers. It
  breaks the native plugin compatibility that the protocol keeps.
- **Wider fix:** B. One input-domain contract covers every opaque read
  class, not one API at a time.
- **Previous examples:** The staged observers added descriptor ranges, file
  identity, and resolution manifests one read class at a time before the
  merge.
- **Recommendation:** B. It is the work that the user deferred, and it puts
  the protocol change before the user.
- **Action:** fix after merge, apply B, because the user's decision of
  2026-10-21 moved the confined input design to work after the merge. Its
  implementation changes a protocol decision, so it waits for the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5437).
