# Keep stylesheet bundles across restarts

- **Severity:** Medium. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the open decision of 2026-10-30 in the
  "mokly perf orchistrator" workspace, and decision 2 of the unmerged
  bundle disk cache plan at commit `0677f609`. Updated on 2026-11-21 from
  branch `calummoore/mokly-stylesheet-store-across-restarts-jffu`, which
  chose the start, approved a stored layout, and then parked the store.
- **Location:** `crates/mokly-render/src/stylesheet_store.rs:51`,
  `crates/mokly-render/src/stylesheet_cache.rs`,
  `crates/mokly-render/src/stylesheet_record.rs`,
  `crates/mokly-source-interface/src/read_evidence.rs`, and
  `packages/mokly/src/sidecar/postcss-evidence.ts`.
- **Reason:** On 2026-11-21 the performance orchestrator parked this store,
  because no PostCSS result has complete and stable evidence and no mechanism
  that makes it complete is feasible today. The work restarts only after a
  new decision on its evidence.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet record:** the compiled bundle of one stylesheet root and the
    stamps of its inputs. The stylesheet cache keeps records in memory only,
    under a 64 MiB bound.
  - **Read evidence:** the files and byte ranges that PostCSS code read
    through observed Node APIs, each with a digest. Its coverage is always
    `incomplete`.
  - **Witness:** a digest of the exact bytes that an observed read
    delivered. A late digest, which the core takes after processing, is not
    a witness.
  - **Certificate:** a positive proof that one record has complete and
    stable evidence. No record type has one today.
  - **Stable capture:** the bundle cache rule that each captured input keeps
    its identity and change stamps from its first observation until after
    the compile.
- **Background:**
  - Each new Serve process processes every stylesheet root again. On merged
    `main` at `793d0c77d`, eight warm restarts of `examples/basic` averaged
    2,293.75 ms to `serve.ready`. Each start had 39 stylesheet bundles
    without a record, with a span union of 1,433.25 ms on average.
  - The [read evidence rules](../../docs/protocol/mokly-sidecar-postcss.md#read-evidence)
    report incomplete coverage for every PostCSS result. The record type has
    a consistency check for reuse inside one process, not a durable
    certificate.
  - The [prepared context rules](../../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts)
    now state the decision in force: no process keeps a stylesheet bundle or
    a PostCSS result for a later process. They reject reuse under an age
    limit and reuse that compiles again after readiness.
  - On 2026-11-21 the store reached its approved stop condition, and the
    performance orchestrator parked it. The sections below give the dated
    decisions, the rejected options, the input classes, the census, the
    parked protocol text, and the parked test plan.
- **Problem:** No stored record can prove that a later process checks every
  input that its compile read. So a strict store can admit no PostCSS
  record, and no core-only record has a certificate yet.
- **Impact if no action:** Every restart processes every stylesheet root
  again. On Basic that work is about 1.4 s of a 2.3 s warm start. The
  startup PostCSS preparation of 2026-11-21 hides only the child start.
- **Root question:** Which evidence lets a later Serve process reuse a
  stored stylesheet record without stale output?
- **Options:**
  - **A.** Keep the store parked. Every restart processes again, as today.
    Effort: Small.
  - **B.** Run a feasibility study of a complete PostCSS process boundary
    with deterministic replay. The study names the mechanism, the supported
    platforms, the native plugin behaviour, and the fallback. It reopens the
    decision that keeps native plugins compatible. Bring the parked design
    back to the user with the result. Effort: Medium for the study, Large
    for the build.
  - **C.** Certify core-only records first, under
    [certified-core-stylesheet-records.md](./certified-core-stylesheet-records.md).
    It can help catalogues without PostCSS. It gives Basic under 0.02 s.
    Effort: Large.
- **Left out:**
  - D, an age-limited reuse of a checked opaque snapshot, and E, a reuse
    that compiles again before first Changes. The performance orchestrator
    rejected both on 2026-11-21. "Rejected options D and E" gives the
    reasons.
  - Unlimited opaque persistence. It stores evidence that a later process
    cannot check.
  - A late digest, a declaration, or an equal list of file names as a
    witness. None proves a consumed read.
  - A Tailwind-only exclusion. Other processed roots use the same
    configuration and module context.
  - A scanner-only adapter. It closes no other native read and no plugin
    state, and it can change the discovery of the plugin.
- **Wider fix:** C. A positive certificate keeps each unsupported record out
  of any strict store. It does not certify an opaque plugin.
- **Previous examples:** The bundle cache stores a durable recipe only with
  complete and stable evidence, in `crates/mokly-sidecar/src/durable_recipe.rs`.
  PR #242 made the stylesheet cache serve later attempts in one process.
- **Related:**
  - [certified-core-stylesheet-records.md](./certified-core-stylesheet-records.md):
    the core-only part of this store, parked on the same date. Its
    certificate is the admission guard that this store needs.
  - [confined-postcss-inputs.md](./confined-postcss-inputs.md): the confined
    input design that option B needs for opaque reads.
  - [stylesheet-observed-plugin-config-reads.md](./stylesheet-observed-plugin-config-reads.md):
    the core drops the observed Browserslist read today. No store starts
    before that fix merges.
  - [postcss-config-inputs-per-record.md](./postcss-config-inputs-per-record.md):
    each record copies the configuration inputs, which a stored format would
    copy too.
  - [postcss-request-order-varies.md](./postcss-request-order-varies.md):
    the cumulative read evidence of a record depends on request order.
- **Recommendation:** B, before any store code. Only a proven boundary can
  admit a PostCSS record, and the study is the smallest step that shows
  whether one exists.
- **Action:** ask the user, because the work starts new design and changes
  the decision in force that no stylesheet result persists across processes.

## The item before 2026-11-21

This section keeps the item as it stood before the decisions of
2026-11-21. Its start question is answered below.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet cache:** the in-memory store of stylesheet bundle records,
    one record for each stylesheet root, under a 64 MiB bound.
  - **CSS Modules class maps:** the class-name maps that the core bundles
    for JavaScript entries during `catalogue.validate`, before Serve is
    ready.
  - **OS cache directory:** the per-repository directory outside the
    repository that holds the base extraction, dependency, and bundle
    caches.
  - **Orchestrator:** the agent that coordinated the performance work of
    2026-10-27 to 2026-10-31 and brought its decisions to the user.
- **Background:**
  - On 2026-10-30, `main` at `f93afcea` on a slow machine: warm
    `serve.ready` was 6.6 s. The class maps took 1.5 s. In `graph.prepare`,
    35 stylesheet bundles took 0.88 s of 1.14 s, all without a cache record.
  - Both steps use the stylesheet cache. PR #242 lets it serve later
    attempts inside one process. The cache lives in memory, so every
    restart bundles each stylesheet again.
  - The bundle disk cache plan estimates warm `serve.ready` at about 2.6 s
    on the baseline machine with the compiled bundle kept on disk. Keeping
    the stylesheet cache on disk too gives about 1.2 s (estimate). The user's
    startup target is about 1 s.
  - A stored record needs its own format version, a byte bound, and
    eviction. It also needs a check of its inputs: PostCSS read evidence,
    asset and glob stamps, and the PostCSS configuration files.
  - On 2026-10-30 the orchestrator asked the user when to start this work.
    The user did not answer before the workspaces closed.
  - On 2026-11-16 the performance orchestrator answered decision 2 of the
    bundle disk cache plan with option A. The user had delegated that choice,
    to keep Changes fast and reliable with no change that can exhaust memory
    or disk. The answer set the scope of this item:
    - The bundle disk cache keeps compiled JavaScript bundles only. A warm
      restart runs no bundle compile.
    - This item keeps the stylesheet cache across restarts, for the CSS
      Modules class maps and for graph preparation.
    - This item carries the 1.5 s warm `serve.ready` target of the bundle
      disk cache task, with an estimate of about 1.2 s on the baseline
      machine.
  - The bundle disk cache change adds a `bundles` kind to the OS cache. Its
    rules are in the "Bundle Entries" section of
    [`docs/protocol/mokly-base-cache.md`](../../docs/protocol/mokly-base-cache.md#bundle-entries):
    one file for each entry, a first line with the format version, the Mokly
    version, and a payload digest, its own byte bound, and locks that never
    wait.
- **Problem:** Each restart bundles every stylesheet root again, also when
  no input changed.
- **Impact if no action:** After the bundle disk cache, warm startup stays
  near 2.6 s on the baseline machine, against a target of about 1 s.
- **Root question:** How does a restart skip stylesheet work whose inputs
  did not change?
- **Options:**
  - **A.** Do not start this work. Effort: Small.
  - **B.** Start after the bundle disk cache merges, and reuse its new OS
    cache kind code for a second stored kind. Effort: Large (estimate).
  - **C.** Start now, in parallel with the bundle disk cache. Both branches
    then change the same cache code and must resolve the conflicts. Effort:
    Large (estimate).
- **Left out:**
  - Listening before the class maps are ready. It changes the readiness
    order, and `docs/protocol/mokly-timings.md` records the user's rejection
    of usable navigation before every entry is ready.
  - Folding this work into the bundle disk cache, its option 2D, which was
    option D of this item. The answer of 2026-11-16 to its decision 2 kept
    that change to compiled JavaScript bundles.
- **Wider fix:** None. This is a planning choice.
- **Previous examples:** PR #242 made the stylesheet cache serve later
  attempts in one process.
- **Related:**
  - The [bundle cache](../../docs/protocol/mokly-base-cache.md#bundle-entries)
    of compiled JavaScript: the change that adds it moved the 1.5 s target
    here on 2026-11-16. A stored stylesheet kind can follow its entry format,
    bound, and lock rules.
  - [postcss-config-inputs-per-record.md](./postcss-config-inputs-per-record.md):
    each record copies the configuration inputs, which a stored format
    would copy too.
  - [postcss-request-order-varies.md](./postcss-request-order-varies.md):
    the cumulative read evidence of a record depends on request order.
- **Recommendation:** B. It is the only planned work that reaches near 1 s,
  and it avoids a conflict with the bundle disk cache.
- **Action:** ask the user, because this choice starts new work and no
  recorded user decision covers it.

## Dated decisions of 2026-11-21

- The performance orchestrator chose option B of the start question above:
  start after the bundle disk cache merged, and reuse its cache code for a
  second stored kind. PR #312 had merged that cache on 2026-11-18. A
  separate cache or parallel work against the bundle cache branch was
  therefore unnecessary.
- Stored layout: it approved C, one self-contained snapshot for each side and
  each set of effective stylesheet settings, with each shared context-chain
  entry once. The rejected layouts were these:
  - A, one self-contained entry for each root key. Context bytes repeat on
    disk, and scans and flushes grow with the number of roots.
  - B, separately keyed context entries in the same namespace. Dependent
    entries need their own publication, eviction, validation, and faults.
  - D, a fixed number of hashed buckets for each side. Shared context repeats
    between buckets, and the store needs bucket selection.
  - E, appended segments with a bounded index. It adds index ownership,
    stale entries, and segment eviction.
  - F, PostCSS roots only. Plain roots would still compile after a restart.
  - No storage fails the goal. A separate database or cache directory breaks
    the shared cache. Source-content-only keys cannot replace the evidence
    about resolution, plugins, assets, directory membership, and paths.
- Bounds: a separate provisional 256 MiB namespace bound and a 64 MiB entry
  ceiling, under the format 1 header of the bundle kind. An earlier 512 MiB
  proposal was replaced. The final numbers follow encoded sizes measured on
  Basic, cloud, and large React and sent with the implementation SHA. The
  64 MiB memory bound of the stylesheet cache stays.
- Approved details: a digest of the effective child environment, with no
  value stored or logged; exact original stamps; separate head and base
  ownership with in-memory borrowing of equal plain-CSS records; one shared
  optional writer with the render store gate; no save before first Changes
  or during foreground preparation; no foreground wait; and a direct compile
  after a memory stamp mismatch, with no reread of the stale disk copy.
  Streamed decoding keeps a small, fixed extra memory peak, which a
  measurement must show.
- Admission amendment: only a successful compile with complete and stable
  evidence enters the store, as in the bundle cache. Incomplete or unstable
  records stay in memory and compile again after a restart. The earlier
  reading that incomplete evidence permits disk reuse was rejected. The
  amendment also said: count the eligible roots first, and stop when the
  Tailwind root of Basic does not qualify.
- Stop: the census below found no certified record. The evidence decision
  then offered A, a complete process boundary; B, core-only certificates;
  C, park the store; D and E below; and F, startup PostCSS preparation
  without a store.
- Answer: the performance orchestrator chose F for the active branch, parked
  this store as C, and rejected D and E. It asked for this item and a
  separate core-only item. A complete process mechanism is not feasible
  today, so this design is future work, not a product requirement.

## Rejected options D and E

Both options failed the reliability goal: stale styles or wrong Changes must
not survive a restart.

- D admitted a checked opaque PostCSS snapshot under an explicit age bound.
  - It first covered every mandatory class below. It stamped a conservative
    directory superset without a change to plugin selection or public
    membership. It captured a full startup, and it reused or compiled again
    all PostCSS records of one side together.
  - Unknown native inputs and ambient state stayed trusted.
  - The age bound gates admission at a restart only. Without a forced
    refresh, an admitted record stays in memory for the whole Serve session.
    A hit or a save must never renew the original compile age. So an
    unknown input change can affect styles and Changes for the admission
    window plus the session.
  - A hard elapsed-time gate needs a trustworthy clock across processes,
    such as a same-boot monotonic stamp. A changed boot identity or a
    missing stamp must miss. A wall clock gives no hard bound, because a
    rollback extends it. No portable mechanism exists.
  - A fixed-restart allowance needs a durable claim across competing
    processes and interrupted writes, with no wait. No design exists.
  - Its check cost was never measured. A 50–100 ms engineering allowance is
    not evidence. Its estimated gain was about 1 s when every root hits, and
    none after an expiry or a context miss.
- E loaded checked stored results for readiness and compiled PostCSS again
  before first Changes.
  - It serves stale output until the fresh generation publishes. Foreground
    work, scheduling, and a failed compile can extend that window, so no
    fixed bound in seconds holds.
  - It breaks the rule that a warm unchanged root runs no PostCSS. It gives
    no established first Changes gain, and it adds a full compile after
    readiness.
- Deleting the cache directory refreshes no running process. Only a restart
  after the deletion forces a compile.

## Mandatory input classes

A store that admits a PostCSS record keeps every in-process check of today
and covers each class below. Memory reuse inside one process trusts some of
these classes today. A restart compiles them again today.

| Class                                                                                                                     | Today, inside one process                                                                                                              | A stored record needs                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolved plugin modules, manifests, and native binaries                                                                   | Known paths keep late content digests. Some reads have witnesses.                                                                      | A content digest of each, `.node` files included, and proven capture stability. A late digest stays a late digest.                                                                                                  |
| Reported files and directories                                                                                            | The core inventories allowed source files and walks its own globs. Reports under `node_modules` or outside the repository are ignored. | Mokly digests and listings of every report, installed and outside-root data included, as private inputs. A wider check keeps plugin selection and public membership unchanged.                                      |
| Scanner controls                                                                                                          | The record does not prove each ignore control or native lookup.                                                                        | Local and ancestor `.gitignore` and `.ignore` files, resolved Git metadata, configuration, include chains, global excludes, missing control paths, listings, links, and identities. An unknown domain fails closed. |
| PostCSS configuration                                                                                                     | Local configuration imports are checked. The observed Browserslist read is dropped.                                                    | The configuration, every import, every other observed configuration witness, and each missing resolver candidate, after the Browserslist fix.                                                                       |
| Environment and identities                                                                                                | Fixed inside a process. No stored stylesheet format exists.                                                                            | A hash of the effective child environment, with no value stored or logged, the format version, and the Mokly, Node, native, and toolchain identities.                                                               |
| Other native reads, helpers, mapped files, system libraries, network, time, random values, plugin state, and side effects | Memory reuse trusts them inside one session.                                                                                           | An exact closure, or a bounded rule that the user approves first.                                                                                                                                                   |

A late digest never becomes a witness, and raw coverage never becomes
complete because a witness exists.

The direct Tailwind diagnostic on Basic found 554 known module paths. Fifty
have no read witness, the Tailwind oxide and Lightning CSS native bindings
included. The core already keeps late digests for those 50 paths, so they
are provenance gaps, not wholly unchecked files. 504 module paths have a
witness. The 509 count of that run is every observed whole-file path. Twelve
reported source files that the native scanner reads have no read witness,
but they have late digests. Four observed reads fall outside the known
modules and reports: the Basic `.browserslistrc`, the root `package.json`,
`/proc/self/exe`, and `/usr/bin/ldd`. The diagnostic is one direct
`processCss` call for one root. It is not a Serve record capture or a
complete inventory.

## Root census and measured data

The census ran on runtime `d5f53f82c` with a release native core of SHA-256
`ee37da15096d07675aefd1600c252b1760fb520a655233c5698eb711a744bd2f`.

| Catalogue                                                            | Roots | Roots with PostCSS | Core-only candidates | Certified today |
| -------------------------------------------------------------------- | ----: | -----------------: | -------------------: | --------------: |
| Basic, `examples/basic/mokly.config.json`                            |    39 |                 36 |                    3 |               0 |
| Current monorepo cloud, `mokly.config.json`                          |   161 |                  0 |                  161 |               0 |
| Isolated `mokly-cloud` at `194fdb789b243ca649a592c6488e8d56b0a32be5` |    60 |                  0 |                   60 |               0 |

- Basic makes 38 PostCSS calls. Its 3 core-only roots run no PostCSS,
  although the configuration names a PostCSS module. Admission is therefore
  a property of each record.
- Basic, 8 warm starts with `--sidecars 2` and pinned Node 24.21.0: ready
  mean 2,293.75 ms, range 2,074–2,553 ms. CSS span union mean 1,433.25 ms,
  range 1,293–1,668 ms. First PostCSS 497–656 ms, mean 539.6 ms. Bundle
  cache hit 402–542 ms, mean about 0.49 s.
- A probe that hashed the known footprint streamed 28,021,040 bytes across
  571 files, and 17 control candidates were absent. Eight warm rounds
  averaged 31.68 ms, range 27.91–43.99 ms. It omits complete discovery, the
  real tree checks, stability, decoding, and replay, so it is a partial cost.
- Isolated cloud, 3 warm starts: ready mean 1,756.67 ms, range 1,297–2,114
  ms, and CSS union mean 160.67 ms. It has no PostCSS.
- The estimates of the evidence decision were not measurements: A at most
  1.43 s before its costs, B under 0.02 s on Basic, D and E about 1 s, and F
  0.3–0.45 s.

## Parked stored-record proposal

This section keeps the protocol text that the branch wrote on 2026-11-21. It
is a proposal, not a requirement in force. A branch that builds the store
moves it into a new protocol page and into the pages that "Changes to other
pages" names. That branch also replaces the decision in force that no
stylesheet result persists across processes.

### Use

The stylesheet store keeps the compiled stylesheet records of `mokly serve`,
so that a later Serve process can reuse them instead of compiling them
again. It is the stylesheet kind of the
[Mokly cache](../../docs/protocol/mokly-base-cache.md). The
[common cache rules](../../docs/protocol/mokly-base-cache.md#cache-location-and-ownership)
give its location, ownership, receipts, durability, and eviction order. The
stylesheet cache is the memory cache of stylesheet records in each process.
Its 64 MiB bound and its reuse rules follow the
[dependency retention rules](../../docs/protocol/mokly-imported-styles-postcss.md#dependency-retention).

Serve reads and writes the store for the head side and for the base side of
Changes, which the [comparison contract](../../docs/protocol/mokly-comparison.md#sides)
defines. `build` and `publish` neither read nor write the store. They
compile each stylesheet root as they do without it. The store has no
setting.

### Snapshots

The store keeps at most one entry for each side and each set of effective
stylesheet settings. The entry holds one self-contained snapshot of the
storable records of that side. Each record keeps its delivered stylesheet
and the results of its compile: read evidence, dependency usage, class maps,
asset records, and watch inputs. The snapshot keeps the module evidence of
each PostCSS context once, for all records of that context.

Each record and each entry of context evidence keeps the stamps of its
original compile. A read never takes new stamps from the current tree.
Decision: a stored record keeps its original stamps. New stamps at the read
were rejected, because the record would then match the tree that checks it.

A save replaces the entry of its side and settings with a new snapshot of
the storable records that the stylesheet cache of the side keeps. The head
and each base have separate entries, also with equal settings. A save of
one side never replaces the entry of another side. A base can still reuse
an equal plain-CSS record of the head in memory, after the checks of its own
side.

### Admission

The store admits each record on its own evidence. A save stores a record
only when its compile succeeded and its evidence is complete and stable,
under the admission standard of the
[bundle cache](../../docs/protocol/mokly-base-cache.md#stable-capture). A
`postcss` module in the configuration excludes no record by itself.

Evidence is complete when it witnesses every input that the compile read,
and each resolver probe and absence that selected those inputs. A record
with a PostCSS result is complete only when the
[read evidence](../../docs/protocol/mokly-sidecar-postcss.md#read-evidence)
of that result reports complete coverage. A declaration, a late digest, or
an equal list of file names is not a read witness. No step marks evidence
complete when its compile reported it as incomplete.

Evidence is stable when its checked paths keep their identity and change
stamps from their first observation until after the compile. The checked
paths are each directory on the path to a recorded input, and each recorded
configuration or manifest file. The file systems and the known limit of the
[stable capture rule](../../docs/protocol/mokly-base-cache.md#stable-capture)
apply. A stylesheet compile never waits for stability. A change too recent
for the time resolution of the file system makes the evidence unstable.
Bytes that a base side reads from its pinned commit cannot change, so the
captured commit identity proves their stability. Mutable inputs on the file
system still need the checks above.

A record with incomplete or unstable evidence stays in memory only. It keeps
each reuse rule of the stylesheet cache inside its process. A later process
compiles it again, and Mokly prints nothing for it. Under the read evidence
rules every PostCSS result is incomplete, so this covers every PostCSS
result today.

### Identity

The key of an entry covers the side, the physical source root of the side,
its effective stylesheet settings, and the build identity. The settings are
the configuration, the module resolution and CSS resolver settings, and the
physical paths of the selected dependency roots and repository roots. Serve
reuses an entry only when each part equals that of the side that it
prepares.

The build identity covers the platform and the build of the native core, as
for the [render store](../../docs/protocol/mokly-render-store.md#identity).
For a configuration with a `postcss` module, it also covers the
[toolchain identity](../../docs/protocol/mokly-sidecar-recipes.md#reuse-and-identity)
of the sidecar and a digest of the effective environment of the PostCSS
child. The digest covers each variable that the child receives under the
[source worker environment rule](../../docs/protocol/mokly-sidecar-modules.md#source-root-workers).
Mokly never stores or logs an environment value. A changed digest is a
normal miss. A configuration without a `postcss` module has no environment
part and starts no sidecar process for the store. When the build identity of
a side is unavailable, the side neither reads nor writes the store.
Decision: the digest covers the whole effective environment. A list of
allowed variables was rejected, because a plugin can read any variable, and
the default `optimize` of Tailwind follows `NODE_ENV`.

### Reads

Before a side compiles a root that has no record in memory, it reads its
entry, at most once in each process. The read adds records only to the
stylesheet cache of its own side, under its 64 MiB bound and its eviction
rule. The read streams the entry, and its other memory is a fixed amount.

Each loaded record passes the reuse checks of a record that the process
compiled, against the current tree of its side. A base side checks against
its pinned Git sources. No check accepts a record from equal modification
times alone. A record that fails a check compiles again. A record that
passes runs no compile and gives the stylesheet, evidence, dependency usage,
class maps, assets, and watch inputs of its original compile. A record in
memory whose stamp no longer matches compiles again at once and causes no
read of the entry.

No read waits for a lock or a save. A held entry lock turns the read into a
miss. The first read of the store in a process reports the cache directory,
also when it finds no entry, under the
[cache directory rule](../../docs/protocol/mokly-terminal-cache.md#cache-directory).

### Saves

After a preparation of a side, Serve offers the side for a save. Saves use
the writer and the gate of the
[render store](../../docs/protocol/mokly-render-store.md#writes). The writer
starts an encoding or a publication only after the first Changes result,
and only while Serve is idle. It checks the gate again before each
publication. A save that ends before its publication is a skipped save. No
Serve preparation, render, or state publication waits for a save.

A pending save holds no copy of a record and keeps no side alive. A save
takes the records from the stylesheet cache of its side when it runs. A
released side drops its save. A save streams its entry and releases its
buffers at the end. A held lock skips the save. Shutdown drops the pending
saves. A save whose records equal those of the entry ends without a write. A
snapshot above the 64 MiB entry ceiling is not written.
Decision: stylesheet saves and render store writes share one writer and its
gate. A writer for each kind was rejected, because two writers could flush
to disk at the same time.

### Entry format and faults

The data of an entry is one file. Its first line is that of a
[bundle entry](../../docs/protocol/mokly-base-cache.md#bundle-entries):
format version 1, the Mokly version that wrote it, and the SHA-256 digest of
the payload. A reader rejects another format or Mokly version, or a file
above the entry ceiling, before it reads the payload. A read checks the
payload digest, then the side and the settings of the payload, before it
uses a record. One durable receipt with a publication id and a digest of the
records publishes the whole entry.

Every rejected entry is a miss, and no store fault fails a preparation, a
publication, or a command. The fault classes of the bundle cache apply:

- An entry fault is a damaged, unreadable, or foreign entry. It writes the
  entry warning at each read, and the store stays on. Mokly tries once,
  without a wait, to remove the entry.
- A store fault is a file system or platform error outside one entry, or an
  invalid cache location. It writes the directory warning once, and the
  store stays off for the rest of the process.
- A normal event writes nothing: a held lock, no room for a save, a snapshot
  above the ceiling, incomplete or unstable evidence, an unavailable build
  identity, a changed environment digest, a failed record check, a released
  side, or a skipped or cancelled save.

### Bound, restarts, and deletion

The kind has its own provisional 256 MiB bound. It counts complete entries,
staged writes, and replaced or evicted data that is not yet deleted. Before
a save, Mokly makes room for the whole entry: it removes the replaced entry
first, then evicts under the common rule. When it cannot make room, it skips
the save. A later Serve process with the same build identity compiles only
the roots that its entry does not hold and the roots whose records fail
their checks. Deleting the cache directory changes time only, within the
known limit of the stable capture rule.

### Changes to other pages

- `docs/protocol/mokly-base-cache.md` adds the stylesheet kind to the
  namespace list and to the separate byte bounds. Its stable capture section
  says that the stylesheet store uses the same admission standard.
- `docs/protocol/mokly-imported-styles-postcss.md` says, under "Dependency
  Retention", that a later process reuses a bundle only through the store,
  and that each bundle with an incomplete PostCSS result compiles again.
- `docs/protocol/mokly-terminal-cache.md` lets the store share the one cache
  directory line of the five caches. It adds two warnings:
  `Cached stylesheets could not be reused. Building them again.` for an
  entry fault, and
  `The stylesheet cache is unavailable. Building stylesheets without it.`
  for a store fault, at most once per process.
- `docs/protocol/mokly-timings.md` adds two budget rows: a 256 MiB
  (268,435,456 bytes) namespace with complete and staged entries together,
  and a 64 MiB (67,108,864 bytes) entry.
- `docs/protocol/mokly-sidecar-postcss.md` replaces its decision that no
  process keeps a stylesheet result for a later process.

## Parked design notes

- Load the snapshot of a side at its first lookup without a memory
  candidate. Measure read, decode, evidence check, and replay separately.
  Prefetch stays optional.
- Store the context chain in base-first order without recursive encoding.
  Never use record constructors that take new stamps from the current tree.
  Rebuild memory charges from decoded allocations, not stored charges.
  Intern the original chain entries, check each entry once per attempt, and
  stream the codec without a second complete payload buffer.
- Keys, a design call: keep the current side and resolution keys. PostCSS
  keeps its physical source root in the key, because its worker receives
  physical paths and its records hold physical asset and file identities.
  Give each side a distinct snapshot key, plain CSS included. A base lookup
  never changes the head memory store.
- Writer: offers hold weak store references and bounded key metadata, not
  stylesheet text. Recheck activity before publication. Release codec
  buffers between saves. Cancellation and shutdown drain no queue on a
  readiness or edit path.
- Toolchain identity, a design call: bind PostCSS records to the sidecar
  toolchain identity, which covers the package, Node, and esbuild versions,
  the installation root, and the built package files. Reuse it from a
  JavaScript bundle result. Without JavaScript, get it without running
  PostCSS. A typed sidecar request keeps Rust as its type owner.
- Measure cloud timing on the isolated `mokly-cloud` checkout at
  `194fdb789b243ca649a592c6488e8d56b0a32be5`, and leave other checkouts
  unchanged. Keep its 60 roots apart from the 161 roots of the monorepo.

## Parked test plan

Write no cache red test before a new evidence decision. Amend the admission
cases to the chosen rule first. Keep the existing PostCSS preparation and
in-process evidence tests.

- Replay: load a saved record through the real codec and lookup path.
  Assert exact CSS, class maps, dependencies, assets, watches, and read
  evidence, so that an incomplete replay fails even with equal CSS text.
- Original stamps: change a source after the save, then load the old
  snapshot. Assert a miss and the newly compiled bytes. Include an asset
  projection and a directory membership change.
- Round trip: keep observed versions, late digests, byte ranges,
  identities, and context entries distinct. Reject inconsistent chains. Use
  a long shared chain to check iterative decoding and shared charging.
- Stale memory: change the stamp of a memory candidate and offer the old
  disk entry. Assert one compile, no second disk lookup, and the CSS.
- Sides: load once per side and settings. Check the shared context stamp
  once per attempt with operation counts. Extend the borrowing tests for
  plain CSS and PostCSS side isolation.
- Admission: admit only records that the chosen rule allows. Incomplete or
  unstable records compile again after a restart and keep their in-process
  reuse. Never make a certificate by hand.
- Restarts: one isolated two-process harness at the Serve process boundary,
  with a private empty cache. Wait for an explicit successful publication
  after first Changes, and stop every descendant before the restart. Fetch
  CSS and documents through HTTP. Assert the bodies, the hits, and zero CSS
  and PostCSS compiles for eligible unchanged roots against a fresh compile.
- Invalidation, in that harness: imported CSS, a Tailwind utility added and
  removed, a reported file, a reported directory addition and removal, a
  scanner `.gitignore` change, a configuration import, and a plugin module
  or native binding change. Assert fresh output, not only a miss count.
- Identity: a changed environment, toolchain, format, or Mokly version
  misses, and no environment value reaches stored bytes or diagnostics.
- Base: real base preparation and head edits keep each side's bytes and
  snapshot ownership, and keep the immutable base source identity while
  head files change. Check mutable installed inputs apart. Keep the
  preparation context lifetime on failure and cancellation.
- Faults: malformed, foreign, truncated, damaged, and oversized snapshots
  are recoverable misses. Reuse the receipt, lock, confinement, and
  retirement tests of the raw cache. Check byte accounting across staged,
  replaced, retained, and trash entries, and eviction with small budgets.
- Writes: hold a save with controlled pending input and output. Readiness
  and an edit finish with correct output first. No offer starts before
  first Changes or during foreground preparation. Check one shared writer,
  lock skips, and cancellation.
- Memory: feed a snapshot larger than the memory store through the real
  streaming reader. Assert bounded charges, eviction, replay, and released
  buffers. Measure the extra process peak once, as a one-time proof.
- Proofs: record each red assertion before its implementation. Run each new
  asynchronous test ten times. Run the complete gate, the four-fixture
  Build byte proof, the Basic HTTP proof, restart workloads, interleaved
  timing, encoded sizes, check costs, and memory. Add no sleep, retry,
  elapsed-time assertion, or skipped check.
