# Cached HTML trees use twice the memory they need

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from options B and D of decision 5 of the closed
  "Hash-Based Content Caching" workspace, 2026-10-27. PR #222 applied its
  option A, and the user did not answer the rest.
- **Location:** `crates/mokly-html/src/tree.rs:126`,
  `crates/mokly-html/src/tree.rs:23`, and
  `crates/mokly-graph/src/weight.rs:92`.
- **Reason:** The measurement predates later render changes, and no open
  branch owns the HTML tree.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Render cache:** the in-memory store of rendered documents and
    fragments, with a 256 MiB bound that `docs/protocol/mokly-runtime.md`
    states.
  - **Charged bytes:** the cache's estimate of an entry's memory, counted
    against the bound.
- **Background:**
  - `enum Node` in `crates/mokly-html/src/tree.rs:126` stores `Element`
    inline. `Element`, at line 23, holds five optional fields and four
    strings or vectors. So each text or comment node takes the size of an
    element node: 304 bytes on 2026-10-27.
  - Parsing and composition leave spare room in child lists. On
    2026-10-27, 296,000 node slots held 134,000 nodes in `examples/basic`.
  - `nodes` in `crates/mokly-graph/src/weight.rs:92` charges the capacity of
    each child list times the node size. So spare slots count against the
    bound.
  - On 2026-10-27 a document was about 15 KiB of HTML, and its cached tree
    about 185 KiB.
  - PR #222 cut the charge of usage records from 64 times to 2 times their
    JSON size. The tree layout stayed.
- **Problem:** Each cached tree holds about twice the node memory that its
  nodes need.
- **Impact if no action:** The render cache holds fewer documents than it
  could. A catalogue whose base differs from the head evicts more head
  documents and renders them again.
- **Root question:** How does a cached document tree use only the memory
  that its nodes need?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Shrink each child list to its length in one helper that runs
    before the cache stores a tree. On 2026-10-27 this cut node slots from
    85.8 MiB to about 41 MiB in the example. Effort: Small (estimate).
  - **C.** Store elements behind a pointer, so that a text or comment node
    takes only its own size. It touches most of the HTML crate. Effort:
    Large (estimate).
  - **D.** B and C. Effort: Large (estimate).
- **Left out:** Raise the 256 MiB bound. The user kept it on 2026-10-27,
  because a change needs a runtime contract decision.
- **Wider fix:** B. Its one helper keeps every cached tree free of spare
  slots. The node size of option C is a separate cost.
- **Previous examples:** PR #222 corrected the record charge, the other
  part of the same cache problem.
- **Related:**
  - [head-cache-through-base-render.md](./head-cache-through-base-render.md):
    smaller charges leave more room for head entries while the base
    renders.
- **Recommendation:** B. It is a contained change that roughly halves node
  memory. Measure the node size and the slots again before the change.
- **Action:** fix after merge, apply B, because no open branch owns the
  HTML tree, and the numbers need a new measurement first.
