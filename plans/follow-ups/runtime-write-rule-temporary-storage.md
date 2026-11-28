# The write rule misses Git and publish directories

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  a problem outside the scope that the check of finding 13, "The write
  contract excludes authored scratch files", found. The performance
  orchestrator sent two options of that finding to this item on 2026-11-23.
- **Location:** `docs/protocol/mokly-runtime.md` (section No Writes),
  `crates/mokly-git/src/checkout.rs` (`Checkout::new`),
  `crates/mokly-git/src/source_key.rs` (`checkout_key`),
  `crates/mokly-cli/src/publication/build.rs` (`SystemDirectories::create`),
  `docs/protocol/mokly-git.md` (section Child Environment), and
  `docs/protocol/mokly-upload.md` (section CLI).
- **Reason:** Each option changes the write guarantee of the runtime
  contract, and the decision of 2026-11-23 covers only the copies of asset
  responses.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Owned temporary storage:** a file or a directory that Mokly makes in the
    temporary directory of the system for one request or one command.
  - **Unnamed temporary file:** a temporary file with no directory entry. The
    system frees it when its last handle closes, also after a crash.
- **Background:**
  - On `origin/main`, the section No Writes of `docs/protocol/mokly-runtime.md`
    says: "The caches outside the repository are the only other files Mokly
    writes."
  - On 2026-11-23, the performance orchestrator chose to state the unnamed
    temporary copies of asset responses in that section. That was option A of
    the review finding, and the branch applies its text: "The caches outside
    the repository are the only other files Mokly writes, apart from the
    unnamed temporary copies of asset responses. Serve writes such a copy of a
    generated or authored asset so that a response sends exactly the bytes of
    its `ETag`. The copy goes away when the last request or response that
    holds it ends." The orchestrator sent the options C and D of the finding
    to this item. Its option B, copies in memory, was not chosen.
  - The sentence still misses three writers that exist on `origin/main`:
    - `Checkout::new` in `crates/mokly-git/src/checkout.rs` converts the files
      of one extraction batch into a private `mokly-git-converted-`
      directory, so a large file never has to fit in memory. The directory
      goes away on drop.
    - `checkout_key` in `crates/mokly-git/src/source_key.rs` makes a
      `mokly-filter-generation-` directory for a checkout with a filter, and
      salts the checkout key with its path. The directory goes away right
      after that.
    - `SystemDirectories::create` in
      `crates/mokly-cli/src/publication/build.rs` makes a `mokly-publish-`
      directory in the temporary directory of the system, outside the
      repository, and keeps it after the call.
  - The owner pages already give these lifetimes. The section Child
    Environment of `docs/protocol/mokly-git.md` says: "Converted output stays
    in memory or in owned temporary storage outside the repository." The
    section CLI of `docs/protocol/mokly-upload.md` deletes the private
    directory after a successful publication, and it says: "A failed or
    cancelled upload retains the whole private directory."
  - These directories have names, so a crash leaves them behind. An unnamed
    temporary file does not outlive its last handle.
- **Problem:** The section No Writes names the caches and the copies of asset
  responses as the only files that Mokly writes outside the repository. Git
  reads and `publish` also write named temporary directories, and a failed or
  cancelled publication keeps its directory.
- **Impact if no action:** A reader of the runtime contract does not learn
  that Git reads and `publish` write temporary directories, or what a crash or
  a failed publication leaves behind.
- **Root question:** How can the runtime contract state every file that Mokly
  writes outside the repository, with its lifetime?
- **Options:**
  - **C.** One rule for all owned temporary storage. Replace the last
    sentences of No Writes: outside the repository, Mokly writes only its
    caches and owned temporary storage, which it removes when the request or
    the command that owns it ends. Each owner page gives the lifetime of its
    storage. The text must say what a crash leaves behind, because the Git and
    publish directories have names. It must also leave room for the rule of
    the upload page that keeps the directory of a failed or cancelled upload.
    Cost: a later writer needs no new user decision. Effort: Small.
  - **D.** No copy for authored responses. Each request reads the confined
    handle once for the XXH3-128 digest, and a new version also gets its
    SHA-256 tag, with nothing written. A HEAD and a matching `If-None-Match`
    end after that read. A 200 streams from the confined handle, holds back
    the last chunk, and fails the body when the digest of the sent bytes
    differs from the record. One new sentence in the Routes section of
    `docs/protocol/mokly-runtime.md` says that a response whose source
    changes during the send ends with an error, and that the watch reload
    follows. D also removes the failure of
    `plans/follow-ups/authored-requests-need-temporary-space.md`. Cost: each
    200 reads the source twice, and the test needs a reader that changes the
    bytes between two chunks. The Git and publish directories and the copies
    of generated assets stay in the write rule. Effort: Medium.
  - **E.** Name each writer. Extend the sentence with the Git conversion and
    filter directories and the publish build directory, and link the owner
    page of each for its lifetime and for what a crash leaves behind. Cost: a
    later writer needs its own change of the sentence. Effort: Small.
- **Shared assumptions:**
  - No command writes into the repository except `build` into its output
    directory. Source: the first sentence of No Writes. It stays.
  - Each owner page states the lifetime of its storage. Source: the Git page
    and the upload page already do. It stays.
- **Left out:**
  - Change nothing. The page contradicts the code.
  - Keep the authored copies in memory, option B of the finding. It raises the
    peak memory with the size of the active responses, and it does not cover
    the Git and publish writers.
- **Wider fix:** C. One rule covers each owned temporary storage, so a later
  writer cannot make the sentence wrong.
- **Previous examples:** The section "Validation And The Render Cache" of
  `docs/protocol/mokly-imported-styles-assets.md` records the exception for
  the verified copies of generated assets, and it releases each copy when its
  last user ends.
- **Related:**
  - `plans/follow-ups/authored-requests-need-temporary-space.md`.
    Option D here keeps no authored copy, which also removes the failure of
    that item. Under C or E, the fix of that item keeps the sentence true,
    because a copy still goes away when the last request or response that
    holds it ends.
  - `plans/follow-ups/cli-holds-catalogue-in-memory.md`: the same rule. Its
    option C adds spill files of publish outside the repository, which the
    rule of this item must then name.
- **Recommendation:** C. It states one rule that is true for every current
  writer, and the owner pages already give each lifetime. D does not name the
  Git and publish writers, so it cannot replace C, and it fits with the item
  of the authored requests. E keeps a review of each later writer, at the
  cost of a sentence that each new writer must change.
- **Action:** ask the user, because each option changes the write guarantee
  of the runtime contract, and the decision of 2026-11-23 covers only the
  copies of asset responses.
