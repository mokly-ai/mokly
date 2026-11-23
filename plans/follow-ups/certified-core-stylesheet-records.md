# Certify core-only stylesheet records across restarts

- **Severity:** Low. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from branch
  `calummoore/mokly-stylesheet-store-across-restarts-jffu`, where the
  performance orchestrator asked for this item. It is option B of the
  evidence decision of that branch.
- **Location:** `crates/mokly-render/src/stylesheet_record.rs`,
  `crates/mokly-render/src/stylesheet_capture.rs`,
  `crates/mokly-render/src/stylesheet_store.rs`, and
  `crates/mokly-source-interface/src/read_evidence.rs`.
- **Reason:** On 2026-11-21 the performance orchestrator parked this option.
  No record has a certificate today, and the measured saving is small
  before any check cost. It authorizes no implementation and makes no speed
  claim now.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Core-only record:** a stylesheet record whose root ran no PostCSS
    request, so the Rust core read each input itself.
  - **Certificate:** a positive proof, stored with one record, that its
    evidence is complete and stable.
  - **Resolver probe:** one lookup of a candidate path while the core
    resolves an import or an asset, a missing candidate included.
  - **Pinned source identity:** the identity of the base commit, which fixes
    the Git bytes that a base side reads.
- **Background:**
  - Each new Serve process processes every stylesheet root again. The
    [prepared context rules](../../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts)
    state the decision in force: no process keeps a stylesheet bundle or a
    PostCSS result for a later process.
  - The parked store of
    [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md)
    admits only records with complete and stable evidence, under the
    [stable capture rule](../../docs/protocol/mokly-base-cache.md#stable-capture)
    of the bundle cache. That item holds the store layout, the bounds, the
    writer rules, and the test plan.
  - The current record type has a consistency check for reuse inside one
    process. It has no certificate. The store finds PostCSS records only
    through their module evidence, and its settings key covers the whole
    configuration. A record without module evidence proves nothing.
  - The census of 2026-11-21 on runtime `d5f53f82c` found 0 certified
    records everywhere. Core-only candidates: Basic 3 of 39 roots, the current
    monorepo cloud configuration 161 of 161, and the isolated `mokly-cloud`
    consumer at `194fdb789b243ca649a592c6488e8d56b0a32be5` 60 of 60.
  - Basic has 36 roots with PostCSS work and 38 PostCSS calls. Its 3
    core-only roots run no PostCSS, although its configuration names a
    PostCSS module.
  - Saving ceilings before any check: the isolated consumer averaged a
    160.67 ms CSS span union over 3 warm starts, with ready at 1,756.67 ms.
    The 3 core-only roots of Basic took under 20 ms together. One warm start
    of the 161-root monorepo configuration, before PR #459 merged, had a
    249 ms CSS union. The estimated check cost is under 5 ms on Basic. Nobody
    measured it on cloud.
- **Problem:** No core-only record carries a positive proof that a later
  process can check every input of its compile. So a strict store can admit
  none of them.
- **Impact if no action:** Catalogues without PostCSS, such as the cloud
  catalogue, process up to about 0.16 to 0.25 s of CSS again at each
  restart.
- **Root question:** How does one stored core-only record prove that a later
  process can check every input that its compile used?
- **Options:**
  - **A.** Keep the option parked. Every restart processes again. Effort:
    Small.
  - **B.** Give each core-only record a positive certificate at its compile,
    and store only certified records in the parked store layout. The
    certificate needs each of these proofs:
    - a marker that no `processCss` request served the root;
    - each exact read, with its digest;
    - each directory listing that the compile used;
    - each missing candidate of each resolver probe;
    - a stable capture of each mutable input, before and after the compile;
    - for a base side, the pinned source identity for Git bytes, and stable
      install evidence for mutable installed files.

    A record that misses one proof stays in memory and compiles again after a
    restart. Measure the check, decode, and replay costs on cloud before the
    build. Effort: Large.
- **Left out:**
  - A whole-configuration rule, such as "no `postcss` module". Basic shows
    core-only roots under a configured module, and an absence of module
    evidence is no positive proof.
  - A late digest or an equal list of file names as a proof of a read.
  - PostCSS records. They need the complete process boundary of the
    restart item.
- **Wider fix:** B. The certificate type keeps each unsupported record out of
  any strict store, whatever its configuration.
- **Previous examples:** The bundle cache stores a durable recipe only with
  complete and stable evidence, in `crates/mokly-sidecar/src/durable_recipe.rs`.
- **Related:**
  - [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md):
    the broader parked store. This item gives it the admission guard, and it
    gives this item the stored layout. Both wait for the user.
  - [rebuild-rehashes-unchanged-resources.md](./rebuild-rehashes-unchanged-resources.md):
    its fix makes the versioned stylesheet artifact of the graph the common
    source of the stylesheet bytes and digest for Serve, build, and comparison
    reads, and it can reach `crates/mokly-render/src/stylesheet_store.rs`,
    which this item also changes. Design the two changes together.
- **Recommendation:** B, when the user wants the restart gain of catalogues
  without PostCSS. It is the only option that admits a record on proof, and
  its gain is bounded by the measured CSS union.
- **Action:** ask the user, because the work adds a stored format and
  changes the decision in force that no stylesheet result persists across
  processes.
