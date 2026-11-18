# Confine Opaque PostCSS Inputs

Status: Active. On branch `calummoore/fu-confined-postcss-inputs-focb`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Mokly runs the consumer's PostCSS plugins in a child process of the render
sidecar. Observers record a read witness for each read through the Node file
APIs that they wrap. Native addons, helper processes, workers, metadata
calls, `fs.openAsBlob`, and WASI read without a witness. A static build then
has only a late digest of those inputs. A file that changes in a short window
can give CSS from bytes that no check saw. The
[follow-up item](follow-ups/confined-postcss-inputs.md) holds the problem.

This plan is the design that option B of that item asks for. It compares a
frozen input domain under native enforcement with live-file denial, a
snapshot alone, a checked domain, and a pinned environment. Every option is a
design for consistent file inputs. No option makes consumer programs
deterministic, and no option is a general security sandbox. The plan brings
four decisions to the user and changes no product code and no protocol doc.
No milestone starts before the user answers. The design and the milestones
follow the recommended strict combination 1E, 2E, 3I, and 4A. The second
options check recommended the limited combination 1E, 2H, 3G, and 4A. Serve,
JavaScript bundling, and render callbacks are not covered. This design branch
keeps the follow-up item and this plan.

History: decision 56 A (2026-10-19) chose observed-read evidence, incomplete
coverage, late opaque baselines, and native plugin compatibility. It rejected
enforced immutable inputs. User decision 114 A (2026-10-21) closed that work
and moved this design after the merge. The follow-up item, added on
2026-10-29, records "fix after merge, apply B". B authorizes this design
only. The probes of 2026-11-18 are in
`.context/confined-postcss-inputs-design/probe-results.md`. The first options
check of 2026-11-18 added options 2F, 2G, 3F, 3G, and 4D, and it recommended
2F and 3F. Its report is in
`.context/confined-postcss-inputs-design/options-result.md`. The second
options check of 2026-11-18 added options 1E, 2H, 3I, and 4E, and it
recommended 1E, 2H, 3G, and 4A. Its report is in
`.context/confined-postcss-inputs-design/revised-options-result.md`. The
recommendations below keep the alternatives of both checks visible.

Contract owners:

- [PostCSS contexts and evidence](../docs/protocol/mokly-sidecar-postcss.md)
  and [imported stylesheet PostCSS](../docs/protocol/mokly-imported-styles-postcss.md).
- [Static build input fingerprint](../docs/protocol/mokly-export.md#input-fingerprint).
- [Render sidecar](../docs/protocol/mokly-sidecar.md),
  [sidecar module sources](../docs/protocol/mokly-sidecar-modules.md), and
  [base preparation](../docs/protocol/mokly-base-preparation.md).
- [Imported styles configuration](../docs/protocol/mokly-configuration-imported-styles.md)
  and [stylesheet diagnostics](../docs/protocol/mokly-imported-styles-errors.md).
- The [Rust core architecture](../docs/architecture/rust-core.md) and the
  [mokly-platform README](../crates/mokly-platform/README.md).

Replaced ways:

- Late digests as the only baseline of a frozen input, inside a confined
  build only → file-version provenance from the domain manifest, beside the
  observed reads, and under 1E a check of the whole approved domain before
  publication. Consumers: the PostCSS read inventory and side evidence of
  `mokly-render`, the input fingerprint of `mokly-static`, and the PostCSS and
  stylesheet cache checks. Moved in Milestone 5. Not deleted, because
  unconfined builds and Serve keep the old way. The reads ledger keeps
  observed reads, and no converter turns provenance into read witnesses or
  the reverse. Serve, JavaScript bundling, and render callbacks need no
  migration.

## Why no simple guarantee holds

TypeScript paths in this section are under `packages/mokly/src/sidecar/`. The
child records witnesses only for wrapped reads on its main thread. The core
takes late digests after processing
(`crates/mokly-render/src/postcss_read_inventory.rs:68-146`). Coverage is
always `incomplete` (`postcss-evidence.ts:271-282`).

- **Native addons**, such as Tailwind's scanner, read through the operating
  system. Only frozen files under an enforced boundary bind them.
- **Helpers and workers** run without observers (`postcss-preload.ts:27-36`).
  A rule binds them only when it applies before they start.
- **Descriptors** opened before confinement keep working under Landlock and
  under Node's permission model. The probes read one. Closing them at launch
  does not cover descriptors that the run receives later through IPC, shared
  memory, process introspection, or a host service. A strict claim must block
  that import, or the platform is unavailable.
- **Runtime libraries** load from the host. A library that loads after launch
  needs an exact path before the run starts, or a strict domain cannot hold
  it.
- **Metadata** stays visible. Landlock does not mediate `stat`, descriptor
  receipt, IPC file access, `/proc`, or mounts. A copy keeps neither native
  identity nor listing order.
- **Providers and options** can replace the observed APIs or return synthetic
  bytes (`postcss-evidence.ts:109-115`, `postcss-read-options.ts:7-22`).
- **Unknown positions and missing identity** leave no witness
  (`postcss-read-position.ts:86-121`, `postcss-file-identity.ts:10-31`).
- **Resolution metadata** is read by Node's native resolver. The child records
  only manifest paths (`postcss-resolution-evidence.ts:7`).
- **A snapshot alone** cannot confine. Absolute paths, absolute links, and
  inherited descriptors still reach live files.
- **A denial alone** cannot pin bytes. Permitted live files can change during
  the run.
- **Stamps are not bytes.** Equal change stamps miss a change and restore
  inside one tick, and a write through a memory map can update them late.
  Stamps never show the bytes that an opaque reader used.
- **A domain is not coverage.** A domain manifest is not a read witness. It
  gives file-version provenance for frozen files only, and it never shows
  that a file or a range was read. Observed-read coverage stays `incomplete`,
  and no manifest entry enters the reads ledger.
- **A partial domain leaves live parts open.** Under 2B, 2D, 2F, and 2G,
  ignored files, dependencies, ancestor manifests, runtime files, and host
  metadata stay opaque and mutable. 2A and 2C leave the same parts live,
  except that 2A drops ignored files and 2C stamps them. 2H freezes all file
  content but leaves host metadata outside the domain open. Every option
  except 2E gives a partial guarantee.
- **A frozen version is not a final check.** Under 1C, the run reads frozen
  bytes, but the build checks only inventoried inputs against the live tree.
  An unreported file can change before publication without an input change.

## Approaches by read class

"Rule" means confinement. "Stamped" means change stamps over the run.
"Frozen" and "pinned" mean file-version provenance for those files only. No
column gives a read witness. The live part is what a partial domain of
decision 2 leaves live. "3I" means the Linux namespace view of decision 3.
Decision 1 gives the options.

| Read class            | Today                         | Snapshot only                          | Live denial, 1B                                       | Frozen domain, 1C                                                           | Pinned environment, 1D                             | Checked domain, 1E                                                      |
| --------------------- | ----------------------------- | -------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Native addon          | Late digest only              | Copy for derived paths, live otherwise | Denied outside, live and stamped inside               | Frozen part fixed for the run, live part opaque                             | Pinned view only                                   | As 1C, and the whole domain is checked before publication               |
| Helper process        | Late digest only              | Same as native addon                   | Inherits the rule                                     | Inherits the rule                                                           | Runs inside the environment                        | As 1C                                                                   |
| Worker thread         | No observer                   | Same as native addon                   | Same process rule                                     | Same process rule                                                           | Runs inside the environment                        | As 1C                                                                   |
| Metadata call         | Not observed                  | Copy metadata, live outside            | `readdir` denied outside, `stat` open on Linux        | Metadata view inside, host paths open under Landlock alone, absent under 3I | Pinned metadata view, host paths absent            | As 1C, and metadata is checked before publication                       |
| `fs.openAsBlob`       | Not observed                  | Same as native addon                   | Denied outside, probed                                | Same as native addon, probed                                                | Pinned view only                                   | As 1C                                                                   |
| WASI                  | Not observed                  | Same as native addon                   | Denied outside, unproven                              | Same as native addon, unproven                                              | Pinned view only, unproven                         | As 1C                                                                   |
| Resolution metadata   | Late manifest paths           | Copy inside                            | Live and stamped                                      | Frozen under 2E and 2H                                                      | Pinned                                             | As 1C, and recorded absence is checked                                  |
| Unknown position      | No range witness              | Copied bytes at any position           | Stamped, no exact bytes                               | Frozen part fixed, live part opaque                                         | Pinned bytes                                       | As 1C                                                                   |
| Provider or option    | No witness                    | Copy for derived paths                 | Same process rule                                     | Same process rule                                                           | Runs inside the environment                        | As 1C                                                                   |
| No native identity    | No identity check             | Not needed for copied files            | Stamps need identity                                  | Not needed for the frozen part                                              | Not needed                                         | As 1C                                                                   |
| Absolute path or link | Live                          | Live, an escape                        | Denied outside                                        | Denied, or frozen at its live path under 3I                                 | Absent unless mapped                               | As 1C                                                                   |
| Descriptor            | Live                          | Live                                   | Closed at launch, later receipt open                  | Closed at launch, later import blocked or a stated limit                    | Closed at launch, host services by setup           | As 1C                                                                   |
| Edit during the run   | Missed before the late digest | Copy safe, escapes missed              | Aborts on a stamp change, misses a change and restore | Frozen bytes fixed for the run, only inventoried inputs checked             | Pinned view fixed, only inventoried inputs checked | Any approved-domain change is an input change, unrelated edits included |

## Proposed design

This section follows the recommended strict combination 1E, 2E, 3I, and 4A.
Under the limited combination of the second options check, 1E, 2H, 3G, and
4A, host metadata outside the domain stays a stated limit, and Linux can use
Landlock as a candidate. Another answer changes the parts that it names.

- **Components.** A domain builder in the core captures, maps, checks, and
  removes the build-private frozen domain of each side. A launcher in
  `mokly-platform` closes inherited descriptors, sets up the platform
  boundary, and starts Node. On Linux, the candidate boundary is a user,
  mount, and PID namespace. On macOS, it is a Seatbelt profile. Neither is
  proven yet. The sidecar starts each PostCSS child through the launcher. An
  option of `build` and `publish` requests the guarantee.
- **Domain categories.** Each category has one boundary:
  - Approved sources, frozen: the Git-visible files of the repository and of
    each nested repository or submodule below it. Without Git, every regular
    file below the repository root outside the folders that discovery denies.
  - Approved generated inputs, frozen: the ignored files and folders that an
    approved list in the configuration names.
  - Packages, frozen: the selected `node_modules` folders of the side, with
    the toolchain, native, and plugin packages, their package metadata, and
    their link topology.
  - Ancestor configuration, frozen: each existing `package.json`, browserslist
    file, and other configuration file that a supported lookup reads above the
    repository root and above each dependency folder. Milestone 1 lists the
    names in the protocol.
  - Runtime, frozen: the preloads that `NODE_OPTIONS` names, Mokly's package,
    esbuild, the Node executable, the system loader, the runtime libraries of
    these executables and of the native addons, and the resolver and
    certificate configuration. The core copies each exact required file
    before launch. A library that loads later must be in this predeclared
    runtime domain, or its access fails. The domain never widens to a live
    library folder after launch.
  - Scratch folder, writable: the run's own output, never an input.
- **Outside file provenance.** These channels stay outside the guarantee,
  each with a stated bound: kernel endpoints such as device and process
  files, network and sockets, environment variables, clocks, randomness,
  bytes that the sidecar or another process supplies at run time, and
  descriptors received after launch. A run cannot bring a host file
  descriptor into the frozen-file claim. The launcher blocks that import, or
  the machine counts as unavailable.
- **Metadata view.** The frozen view keeps names, folder memberships, entry
  kinds, link targets, sizes, read and execute modes, and modification times.
  It does not keep native identity, change times, hard link counts,
  ownership, extended attributes, or listing order. A lookup of a path that
  the domain does not hold fails inside the frozen view, also when the live
  file exists. Under 2E, host metadata outside the domain is hidden, and a
  machine that cannot hide it counts as unavailable.
- **Capture.** After the build captures root membership, the core lists each
  category and copies each entry once, with a copy-on-write clone where
  possible. It records the stable-capture stamps of each live entry before
  and after its copy. A change during the copy marks the entry as changed for
  the final check. The domain is stored below a private root that mirrors the
  live absolute paths. Under 3I on Linux, the namespace shows each frozen
  entry at its live path. On macOS, the run sees the mirrored paths. A
  capture during concurrent edits can freeze a mixture of versions, so the
  domain proves no global atomic source snapshot.
- **Freeze.** An immutable manifest records each entry of the metadata view
  and each known ancestor configuration name that was absent. A unique id for
  each capture is the domain id. Nothing writes the domain or the manifest
  after capture.
- **Run.** The working directory, `PWD`, `from`, and module paths name frozen
  paths. Under 3I, those are the live paths inside the namespace. `TMPDIR`
  names the scratch folder.
- **Reuse.** Each request of the side in one build reuses the domain and its
  contexts. A confined result is reused only when its generation, domain id,
  runtime identity, and policy all match.
- **Dispose.** After installation, failure, or cancellation, the core stops
  and reaps every process of the confined runs. Then it removes the domain at
  its last lease. Crash cleanup at a later start removes only domains whose
  owner holds no lease. It never removes a domain of another active build.
- **Head and base.** The head domain takes the place of the live source root.
  The core maps frozen paths to logical names, as it maps base extraction
  paths. The base side always copies its leased extraction into its
  build-private domain, because unconfined runs can write the shared
  extraction. A read-only view of the shared extraction cannot stop writes
  through another alias.
- **Aliases.** The domain never shares a file with the live tree. Absolute
  links into a frozen category point into the domain. Live hard links and
  bind mounts cannot reach the domain.
- **Writes, IPC, and providers.** Writes go to the scratch folder only. The IPC
  channel stays, and the sidecar reads no file for the run. A local socket to
  a service outside the run counts as network. Consumer preloads, loaders,
  and hooks run inside the boundary.
- **Provenance and the final check.** The core digests a frozen file lazily,
  when an inventoried input needs its frozen version. That version joins the
  versions of the input, and a conflict is an input change. Under 1E, the
  core also checks the whole approved domain against the manifest before
  publication: membership, recorded absence, the metadata view, and content.
  Each comparison uses exact content and metadata, or the existing
  stable-capture contract with its stated limit on its supported volumes.
  Equal timestamps alone never prove bytes. Any difference is an input
  change, also for a file that no plugin reported and for an unrelated edit.
  The check shows no read. It shows only that the frozen versions still match
  the live tree.
- **Caches and privacy.** Cache entries charge only their own bytes. The
  disk use of a domain is an artifact lease, outside every cache bound. No
  cache bound changes, and no domain quota exists. The whole-domain check of
  1E is part of fingerprint validation only. The manifest and that check add
  no catalogue member, protected input, public file, or watch path. Frozen
  paths never reach output or diagnostics.
- **Errors.** A requested command fails with a diagnostic when the boundary
  is unavailable or the capture fails. An unrequested build keeps today's
  behaviour. An unreadable source file keeps the fixed unreadable marker. A
  denied or absent read fails the plugin with today's `postcss` failure and
  one line that names confinement. A plugin that silently skips a denied or
  absent file stays undetected.

## Proposed requirements

These wait for the decisions. Milestone 1 writes the chosen ones into the
protocol. Each item names the decisions that settle it.

- A `build` or `publish` that requests the guarantee runs each PostCSS context
  from the build-private frozen domain of its side. Decisions 1 and 3.
- Every process and thread of the run starts inside the boundary. The
  boundary denies file content reads outside the domain and writes outside
  the scratch folder. Decisions 1 and 4.
- The chosen domain option sets one metadata rule. Under 2E, host metadata
  outside the domain is hidden, and a machine that cannot hide it is
  unavailable. Under 2H, it is a stated limit. Decision 2.
- A run cannot bring a host file descriptor into the frozen-file claim. The
  boundary blocks that import, or the machine is unavailable. Decisions 2
  and 3.
- The version of a frozen file is file-version provenance: the only version
  that a read of its path inside the domain delivers. It is not a read
  witness. Decision 1.
- Results keep `readEvidence.coverage` `incomplete`. A separate domain record
  names the domain, and no manifest entry enters the reads ledger.
  Decision 1.
- Under 1E, any difference between the approved domain and its manifest
  before publication is an input change, also for an unrelated edit. For a
  requested build, this replaces the fingerprint decision in
  `docs/protocol/mokly-export.md:155-158`. Decision 1.
- The domain proves no global atomic source snapshot. An inventoried input
  whose versions conflict is an input change before publication. Decision 1.
- Kernel endpoints, network and sockets, environment variables, clocks,
  randomness, bytes supplied at run time, and descriptors received after
  launch stay outside file provenance. Decisions 2 and 4.
- A requested command fails where the boundary is unavailable or the capture
  fails. Unrequested builds and Serve keep today's guarantee, and native
  addons stay loadable in all modes. Decision 3.
- The guarantee covers consistent file inputs. It does not make programs
  deterministic, and it is not a general security sandbox. Decision 1.

## Design calls

Agent calls of 2026-11-18, for the recommended combination. A call never
widens the domain, adds a live host folder, or changes behaviour after a
failed proof. Each of those needs a user decision.

- A separate domain record names the domain, and coverage stays `incomplete`.
  A domain proves reachable file versions, not observed reads.
- The core owns the domain, because the sidecar writes no file
  (`docs/protocol/mokly-sidecar-modules.md:136`).
- The domain uses clones or plain copies. A hard link is a mutable alias.
- The base side copies its leased extraction, because unconfined runs can
  write the shared extraction (`docs/protocol/mokly-base-preparation.md:28-40`).
- The launcher sets up the boundary before Node starts. A rule that applies
  later misses threads that already run.
- The launcher closes inherited descriptors except the standard streams and
  IPC. The probes read an inherited descriptor.
- Under 3I on Linux, the namespace root holds only the frozen domain, mounted
  read-only at its live paths, the scratch folder, and the kernel endpoints.
  Landlock, where present, adds a second boundary for content reads, writes,
  and abstract Unix sockets.
- Under 2H, Linux uses Landlock as the candidate for pathname content reads.
  A Landlock ABI below 3 counts as unavailable, because it cannot deny
  truncation.
- The launcher checks availability on each machine at run time, because user
  namespaces, the Landlock ABI, and container profiles differ between
  machines.
- The core digests a frozen file lazily, for an inventoried input or for a
  final comparison that the stable-capture contract cannot decide. Eager
  digests add the cost that the fingerprint decision rejects.
- The capture copies modification times with the content, where the file
  system can store them.
- The domain builder lists each nested repository and submodule itself,
  because Git lists a submodule as one entry.
- The core finds the runtime libraries of each frozen executable and native
  addon before launch. It never adds a library during the run.
- The domain holds no Git metadata. A failed Git-aware parity proof is a
  finding for the user.
- The core trusts the frozen copy after capture and reads it only for lazy
  digests. A process of the same user outside Mokly can still write it, and
  the guarantee does not cover that.
- A failed confined request adds one diagnostic line that names confinement.
  Milestone 1 sets its text.

## Proof obligations

No guarantee ships before its proof passes. A failed platform proof makes
that machine or platform unavailable, and a requested command fails there. A
failed parity proof is a finding for the user, not a design call. Each
mechanism stays a candidate until its full proof passes.

1. **Linux namespace.** Under 3I, a user, mount, and PID namespace runs Node
   22 and 24, Tailwind 4, and lightningcss with only the frozen domain at its
   live paths. Host paths and their metadata are absent, `/proc` shows only
   the run, and no host descriptor enters the run. Prove it on the oldest
   supported kernel, the CI runners, and default Docker, where user
   namespaces can be blocked.
2. **Linux Landlock.** Landlock ABI 3 or later is a candidate for pathname
   content reads and writes only. Native addons, helpers, workers, WASI,
   `fs.openAsBlob`, memory maps, io_uring, and symbolic links each need a
   proof. Record what it does not mediate: `stat`, received descriptors, IPC,
   `/proc`, and mounts.
3. **macOS.** A Seatbelt profile runs Node 22 and 24, Tailwind 4, and
   lightningcss on macOS 11 and later. Prove which reads and which metadata
   it denies, and that a lookup above the private root acts like an absent
   path. Prove how the frozen runtime treats system libraries that macOS
   keeps in its shared library cache. A failure there is a finding for the
   user.
4. **Pinned environment.** Under 1D, the environment runs Node and native
   plugins with only the frozen view, and host paths are absent.
5. **Descriptors and immutability.** A confined child holds only its streams,
   IPC, and own descriptors at launch, and it cannot import a host descriptor
   later. No run can write, truncate, rename, or link a frozen file.
6. **Runtime.** Node, esbuild, and the native addons run from the frozen
   runtime. A library outside the predeclared runtime fails to load. Network
   access under 4A works with the frozen resolver and certificate files.
7. **Parity.** Confined and unconfined runs give the same CSS and dependency
   messages for Tailwind 4, autoprefixer with browserslist, postcss-import,
   and a lightningcss plugin. A denial changed Tailwind's dependency messages
   from 46,611 to 3 in the probe.
8. **Edits, layouts, and base.** A live edit during a run never changes
   confined CSS. Under 1E, an edit of any approved file, an added or removed
   file, and a new ancestor configuration file each give the input-change
   outcome. npm, pnpm, and Yarn workspace links resolve into the domain. A
   write into the shared base extraction never changes a confined result.
9. **Cost.** Measure capture time, final check time, disk use, and launch
   time on the large React fixture, and report them. The measurement sets no
   limit.

## Implementation scope

This scope is not a decision. Docs: the contract owners, the command and
configuration guides, and each changed README. Rust: `mokly-platform`,
`mokly-cli`, `mokly-render`, `mokly-source-interface`, `mokly-sidecar`,
`mokly-static`, `mokly-compare`, `mokly-git`, and `mokly-catalogue`.
TypeScript: `postcss.ts`, `postcss-worker.ts`, and `postcss-evidence.ts` of
the sidecar, the generated sidecar types, and
`packages/mokly/config.schema.json`. Tests: crate unit tests and sidecar and
static PostCSS tests for the approved requirements, at the lowest level that
can show each one. Existing tests keep every assertion. This plan adds no
budget, quota, gate, or lint. The implementing branch deletes the follow-up
item.

## Decisions

Both options checks of 2026-11-18 are merged. These decisions wait for the
user. No option is applied, and each choice stays open. Decisions 2, 3, and 4
apply only when decision 1 is B, C, D, or E. Each recommendation names the
first recommendation of this plan and the letter that each check
recommended.

**Terms:**

- **Late digest:** a digest of a known input that the core takes after
  PostCSS ran. It detects only edits after that capture.
- **Input domain:** the files and folders that a confined PostCSS run can
  read.
- **Frozen copy:** a build-private copy of input domain files that the core
  makes before PostCSS runs. Each frozen file keeps one version for the run,
  its file-version provenance, which does not show that a read happened.
- **Confinement:** an operating system boundary, such as a namespace view or
  Landlock on Linux, or Seatbelt on macOS, that limits the file access of a
  process, its threads, and its descendants. It covers only the accesses that
  the mechanism mediates.
- **Change stamp:** the identity, size, and change times of a file or folder.
  Equal stamps alone never prove bytes.

### 1. Opaque PostCSS reads have no witness

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `docs/protocol/mokly-sidecar-postcss.md:76-99`,
  `packages/mokly/src/sidecar/postcss.ts:55-75`.
- **Terms:**
  - **Read witness:** the digest of the exact bytes that an observed Node read
    delivered.
  - **Opaque read:** a read that the observers cannot see, such as a read by a
    native addon, a helper process, a worker, or WASI.
- **Background:** The PostCSS child records read witnesses for wrapped Node
  reads on its main thread. The core adds a late digest for each known input.
  The static build compares all versions before installation. Coverage is
  always `incomplete`.
- **Problem:** An opaque read leaves no witness. A late digest can record an
  edit that came after the read, so the check passes.
- **Impact if no action:** A build can publish stale CSS without an
  input-change error.
- **Root question:** How can a static build make sure that an opaque PostCSS
  read used the file version that the build checks?
- **Options:**
  - **A.** Keep the observed-read guarantee and delete the follow-up item.
    Effort: Small.
  - **B.** Live denial: PostCSS reads live files under confinement. Change
    stamps of every domain file and folder, before and after each run, show
    no change. Any edit aborts the build, also an unrelated one. Stamps do
    not prove exact bytes. They miss a change and restore inside one tick and
    a write through a memory map that updates them late. B is a weaker option
    with residual risk, not a complete solution. It needs the file systems of
    stable capture and reverses the fingerprint decision against a walk of
    every file. A denied read can change a result without an error. Effort:
    Large.
  - **C.** Frozen domain: the run starts from a frozen copy under confinement
    that also denies writes into the copy. Frozen files get exact
    file-version provenance, not read witnesses. Under a partial domain of
    decision 2, the live parts stay opaque and mutable. On Linux, Landlock
    does not mediate `stat`, descriptor receipt, IPC file access, `/proc`, or
    mounts. So C gives no full metadata boundary there without another
    mechanism. C walks and copies every domain file on each confined build,
    which goes against the cost reason of the fingerprint decision
    (`docs/protocol/mokly-export.md:155-158`). Absolute live paths fail. A
    denied read can change a result without an error, as in the Tailwind
    probe. Effort: Large.
  - **D.** Pinned environment: PostCSS and its native plugins run inside a
    container, a virtual machine, or a Linux namespace view that shows only
    the frozen domain and a pinned runtime. Host paths and their metadata are
    then absent. A FUSE or ProjFS provider can serve the frozen view, but it
    hides no host path by itself, so it needs a separate process isolation
    boundary. D needs provisioning, such as a container runtime, a virtual
    machine, user namespaces, or a file system driver. Host paths in a
    configuration fail unless the setup maps them. On macOS and Windows, a
    container or a virtual machine runs another operating system. It cannot
    load the host's native addons, so native plugins need builds for that
    system. This is a compatibility trade-off, not a better option
    everywhere. An absent path can change a result without an error. Effort:
    Large.
  - **E.** C, and before publication the core checks the whole approved
    domain against the frozen manifest: membership, the absence of known
    ancestor configuration files, the metadata view, and content, not only
    reported paths. Each comparison uses exact content and metadata, or the
    existing stable-capture contract with its stated limit. Equal timestamps
    alone never prove bytes. Any difference is an input change, whatever the
    run read, so an unrelated edit in the domain also stops the build. This
    changes the fingerprint decision in
    `docs/protocol/mokly-export.md:155-158`, and the check adds a walk of the
    whole domain before publication. Effort: Large.
- **Shared assumptions:**
  - The target is file-input consistency. Consumer-program determinism is
    outside this item. Source: the task's opaque PostCSS input scope.
  - Native addons, helpers, and workers stay loadable. Source:
    `docs/protocol/mokly-sidecar-postcss.md:96-99`.
  - Observed-read coverage stays `incomplete`. Source: the same page and the
    task message.
  - Only `build` and `publish` confine. Source: the item names the static
    build. The left-out list drops this assumption for Serve.
  - Only PostCSS reads the domain. Bundling and render callbacks read live
    files. Source: the scope of this plan.
  - The sidecar writes no file. Source:
    `docs/protocol/mokly-sidecar-modules.md:136`.
  - Writes and network access follow decision 4.
  - Only inventoried inputs get a frozen-version check. Source: an agent
    design call, made for cost. C already walks the whole domain, so that
    reason is weak. E drops it.
- **Left out:**
  - A snapshot without confinement fails the goal. Absolute paths, links, and
    inherited descriptors reach live bytes.
  - Live denial without stamps or a copy fails the goal. Permitted files can
    change during the run.
  - Stamps over the reported inputs only fail the goal. An unreported opaque
    read stays unpinned.
  - A read-only lock of the live tree fails the goal. The owner can still
    change the mode or replace a file through its folder, and a crash leaves
    the files locked.
  - Node's permission model fails the goal. It denies or frees workers,
    helpers, addons, and WASI, and it follows links out of the domain.
  - Rejecting native addons, helpers, and workers breaks native plugin
    compatibility. Tailwind 4 and lightningcss load native addons.
  - Read logs, such as fanotify, seccomp user notification, EndpointSecurity,
    or ETW, fail the goal. A log records opens, not the bytes that a reader
    used.
  - Confining Serve is outside the goal. Serve has no input-change outcome.
- **Wider fix:** E. One domain contract covers the opaque read classes, and
  its final check needs no plugin report.
- **Previous examples:** The staged observers added one read class at a time.
  The base side already runs PostCSS from a pinned extraction,
  `docs/protocol/mokly-base-preparation.md:27-36`.
- **Related:** Decisions 2, 3, and 4 wait for this answer. With 2E, Landlock
  alone leaves `stat` open, so the strict combination uses the namespace of
  3I on Linux. With 2H, the limited combination can use Landlock as a
  candidate.
- **Recommendation:** E. It is the only option that checks every approved
  file version before publication, also for files that no plugin reported.
  It avoids the residual risk of B's stamps and the cross-system cost of D.
  Its cost is a walk of the whole domain and an input change for unrelated
  edits, and that change of the fingerprint requirement needs the user's
  answer. This plan first recommended C, and the first options check kept C.
  The second options check recommended E.
- **Action:** ask the user, because E changes the protocol decisions against
  enforced immutable inputs and checks of unrelated files. No user decision
  covers those changes.

### 2. No input domain is defined

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-imported-styles-postcss.md:95-98`,
  `docs/protocol/mokly-export.md:144-158`.
- **Terms:**
  - **Git-visible file:** a tracked file, or an untracked file that Git does
    not ignore.
  - **Ignored entry:** a file or folder that Git ignores, such as `dist/`,
    `.env`, or `node_modules/`.
- **Background:** The rule is fixed at launch, so the domain must be known
  before the run. Tailwind scans the source root by default. Plugins also read
  installed packages, generated files, and `.env` files. The dependency
  inventory accepts reported files under `dist`, `target`, and `.context`.
- **Problem:** No contract says which files a confined run can read, which the
  core freezes, and how the build checks the rest. The Tailwind probe shows
  that a denied read can change a result without an error.
- **Impact if no action:** A small domain changes CSS without a diagnostic. A
  large domain costs copy time or leaves live inputs unchecked.
- **Root question:** Which file contents and which metadata can a confined
  run see, and which does the build freeze?
- **Options:**
  - **A.** Freeze the Git-visible files. Read the selected `node_modules`
    folders and the host files live. Ignored entries are absent, so a read of
    a generated input or an `.env` file fails or changes the output without
    an error. Effort: Medium.
  - **B.** A, but the copy links each ignored entry to its live path, which
    keeps today's witnesses and late digests. This is a partial guarantee.
    Ignored files, dependencies, ancestor manifests, runtime files, and host
    metadata stay opaque and mutable. Effort: Medium.
  - **C.** B, and change stamps check the ignored entries and the
    `node_modules` folders over each run. An edit there aborts the build.
    Stamps miss a change and restore inside one tick and prove no bytes.
    Effort: Medium.
  - **D.** B, and a configuration list names more live folders that a run can
    read. It is partial like B. Effort: Medium.
  - **E.** Full frozen-file domain. Freeze the approved sources and the
    ignored or generated inputs that an approved list in the configuration
    names. Without Git, the approved sources follow G. Also freeze the
    selected `node_modules` folders with the toolchain, native, and plugin
    packages and their package metadata. Freeze the ancestor configuration
    files, such as `package.json` and browserslist files, and the resolver
    and certificate configuration. Freeze the preloads, the Node executable,
    and the runtime libraries of the executables and native addons. The core
    copies each exact required file before launch. A library that loads later
    must be in that predeclared runtime domain, or its access fails. The
    domain never widens to a live library folder after launch. The copy keeps
    the link topology and an explicit metadata view, and host metadata
    outside the domain is hidden. Apart from the named kernel endpoints,
    every file that the run can read is frozen. Network and sockets,
    environment variables, clocks, randomness, bytes supplied at run time,
    and descriptors received after launch stay outside file provenance as
    named channels. A machine that cannot enforce this content and metadata
    boundary counts as unavailable. On Linux, that needs a mechanism such as
    3I. Copies of the packages and the runtime cost time and disk on each
    confined build. Effort: Large.
  - **F.** B, and a build without Git counts as a machine that cannot
    confine, under decision 3. One membership rule and one parity proof stay.
    A build without Git gets no guarantee. It is partial like B. Effort:
    Small.
  - **G.** B, and a build without Git freezes every regular file below the
    repository root, except the folders that the discovery walk denies.
    Builds without Git also get the guarantee. It needs a second rule and its
    own parity proof, and it is partial like B. Effort: Medium.
  - **H.** The frozen categories of E, with all file content outside them
    denied. Host metadata outside the domain stays a stated limit where the
    mechanism does not hide it. A plugin that checks whether an absolute live
    path exists, or reads its times, can still change CSS without an error.
    On Linux, Landlock ABI 3 or later is a candidate for pathname content
    reads and writes. Native addons, helpers, workers, WASI, and descriptors
    still need their own proofs. Effort: Large.
- **Shared assumptions:**
  - The domain is known at launch. Source: the Landlock probe.
  - Node needs readable runtime files and existing ancestor manifests, but
    not live ones. Source: the Tailwind probe. A, B, C, D, F, and G read them
    live. E and H freeze them.
  - The domain lives below a private root. Source: an agent design call. A
    lookup that climbs past the mirrored root reaches host folders that an
    unconfined run never sees. 3I drops this on Linux, where the namespace
    shows frozen entries at their live paths.
  - `repoRoot` equals the Git top level, so only manifests above that root
    stay outside the copy. Source:
    `docs/protocol/mokly-configuration.md:135-137`.
  - The base side copies its leased extraction, which holds only tracked
    files. Source: `docs/protocol/mokly-base-preparation.md:16-22` and the
    base design call.
  - The head is a Git worktree. Source: the texts of A to D. It fails,
    because `build` without Changes works without Git
    (`docs/protocol/mokly-configuration.md:138-139`). E, F, and G drop it.
- **Left out:**
  - A domain of only the catalogue roots and the PostCSS module closure fails
    the goal. Plugin inputs are known only after the run.
  - A domain learned from a first unconfined run fails the goal. An
    unreported opaque read stays outside that domain, and the denial then
    changes the result without an error.
- **Wider fix:** None. The domain is part of the wider fix of decision 1.
- **Previous examples:** The input fingerprint rejected a walk of every
  repository file, `docs/protocol/mokly-export.md:155-158`.
- **Related:** Waits for decision 1. Under 1B, the options choose the live
  domain that stamps cover. Under 1D, the domain is the pinned view. E needs
  3I or another mechanism that hides host metadata on Linux. H works with
  Landlock as a candidate, with host metadata as a stated limit. Decision 4
  B needs a live part, which E and H do not have.
- **Recommendation:** E. It is the strict choice. Apart from the named kernel
  endpoints, every file that the run can read is frozen, and host metadata
  outside the domain is hidden. This plan first recommended B. The first
  options check recommended F, and the second options check recommended H.
  F, like B, leaves ignored files, dependencies, ancestor manifests, runtime
  files, and host metadata opaque and mutable. H freezes all content and
  works with Landlock, but host metadata outside the domain can still change
  CSS. E costs copies of the packages and the runtime, needs an approved list
  for generated inputs, and needs 3I on Linux.
- **Action:** ask the user, because the options trade plugin compatibility
  against the reach of the guarantee and no option is clearly best.

### 3. Confinement default and platform gaps undefined

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-sidecar-postcss.md:96-99`,
  `docs/protocol/npm-release.md:15`.
- **Terms:**
  - **AppContainer:** the Windows sandbox that grants file access through
    permission entries on each allowed file and folder.
- **Background:** Mokly ships for Linux, macOS, and Windows. The probes proved
  Landlock on one Linux kernel only. No Linux namespace view was probed.
  macOS Seatbelt is deprecated and not probed. No Windows mechanism without
  administrator rights or permission changes on user files was found.
- **Problem:** No rule says which builds run confined, or what a build does
  where the platform cannot enforce confinement.
- **Impact if no action:** Builds can fail on a platform without a mechanism,
  or users can expect a guarantee that their platform does not give.
- **Root question:** Which static builds run confined, and what happens where
  the platform cannot enforce confinement?
- **Options:**
  - **A.** Opt-in. A new setting asks for confinement in `build` and
    `publish`. With it, a build fails with a new diagnostic where the platform
    cannot enforce it. Without it, nothing changes. Effort: Medium.
  - **B.** On by default where the proofs passed, with a setting that turns it
    off. Elsewhere, builds keep today's guarantee with no message. This is a
    silent downgrade. Effort: Medium.
  - **C.** On by default everywhere, with a setting that turns it off. Builds
    run from the frozen copy, and confinement applies where the proofs passed.
    Elsewhere, the copy runs without confinement. That is a snapshot only,
    with the limits of its table column, and observed-read coverage stays
    `incomplete`. Effort: Medium.
  - **D.** B, and a build warning where confinement is not available. Under
    `--strict`, the warning fails those builds. Effort: Medium.
  - **E.** A, and a Windows mechanism with AppContainer, so that a request on
    Windows can succeed. Until its proof passes, Windows behaves as under A.
    It needs permission entries on user folders, and Node support in
    AppContainer is unproven. Effort: Large.
  - **F.** A, but a build warning replaces the failure when the machine cannot
    confine or the capture fails. The build keeps today's guarantee.
    `--strict` fails the build
    (`docs/protocol/mokly-build-warnings.md:167-178`). Effort: Medium.
  - **G.** A, but the request is an option of `build` and `publish`, not a
    setting. CI asks for it on each run, and builds on other machines never
    fail. Each CI script must name the option. Effort: Medium.
  - **H.** Required by default. Every `build` and `publish` with PostCSS
    confines and fails where the machine cannot enforce confinement. Windows,
    older kernels, and containers that block the Linux mechanism then fail
    each PostCSS build. With 2E and without I, every Linux machine fails too.
    Effort: Medium.
  - **I.** G, and on Linux the launcher adds an unprivileged user, mount, and
    PID namespace. The run then sees only the frozen domain at its live
    paths, so live absolute paths keep working, and host paths and their
    metadata are absent. This is a candidate mechanism for the metadata
    boundary of 2E until its full proof passes. Where user namespaces are
    blocked, Linux is unavailable, and a requested command fails. Effort:
    Large.
- **Shared assumptions:**
  - Linux uses Landlock and macOS uses Seatbelt, each after its proof.
    Source: the platform design calls. It fails with 2E, because Landlock
    leaves `stat` open. I drops it for Linux. Decision 1 D replaces both with
    its isolation.
  - Each machine decides availability at run time. Source: the design calls.
  - Serve ignores the request. Source: decision 1.
  - A failed proof never ships as a guarantee. Source: the task message.
  - The request lives in the configuration. Source: the design and the
    milestones of the first draft. It is not a requirement, and G drops it.
- **Left out:** None. H brings back the required default that the first
  draft left out.
- **Wider fix:** None. The policy decides where decision 1 applies.
- **Previous examples:** Stable capture trusts only listed file systems and
  stays silent elsewhere, `docs/protocol/mokly-base-cache.md:175-197`.
- **Related:** Waits for decision 1. With 2E, only I gives Linux a candidate
  path. With 2H, G can use Landlock as a candidate.
- **Recommendation:** I. It keeps the per-command request of G, which fails
  clearly when a machine cannot give the requested guarantee, and it adds the
  Linux namespace that 2E needs. Machines that block user namespaces then
  fail each request. This plan first recommended A. The first options check
  recommended F, and the second options check recommended G with 2H. Under
  A, a committed setting fails every build of the repository on machines
  that cannot confine. Under F, those builds publish without the requested
  guarantee unless `--strict` is set. No recommended option downgrades a
  request silently. H best protects the guarantee by default.
- **Action:** ask the user, because I adds a command option and a build
  failure where confinement is unavailable. No requirement covers them.

### 4. Confined runs have no write or network policy

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/mokly/src/sidecar/postcss.ts:58-74`,
  `docs/protocol/mokly-sidecar-modules.md:13-24`.
- **Background:** Today a plugin can write any file of the user and open
  network connections. Some plugins write caches under `node_modules/.cache`,
  copy assets, or fetch remote fonts. Landlock grants access only below
  listed paths, so it cannot allow writes everywhere except the copy.
- **Problem:** No rule says where a confined run can write or whether it can
  reach the network. No copy can freeze a network response.
- **Impact if no action:** Write and fetch plugins fail or work by chance, and
  the guarantee is silent on network inputs.
- **Root question:** What can a confined PostCSS run reach besides reads of
  its input domain?
- **Options:**
  - **A.** Writes go only to a private scratch folder that `TMPDIR` names.
    This replaces the inherited `TMPDIR`, a change of the inherited-variable
    rule. The network stays open and outside the guarantee. A local socket to
    a service outside the run counts as network. Effort: Small.
  - **B.** A, and the live parts of the domain stay writable, as today. Caches
    keep working, but a run can change a live input. Effort: Small.
  - **C.** A, and the run cannot open network connections where the platform
    can deny them. Landlock denies only TCP, from Linux 6.7. Fetch plugins
    fail. Effort: Medium.
  - **D.** A, and the run can write inside its private copy. Writes never
    reach the live tree. Every request of the side shares one domain, so a
    write in one run changes the input of another run. A rewritten file has
    no frozen provenance, so the core must find rewritten files after each
    run. Effort: Large.
  - **E.** A, and each run writes into its own copy-on-write layer over the
    domain, which the core discards after the run. Other runs keep the exact
    frozen versions. A file that the run rewrote has no frozen provenance for
    that run, so the core lists the layer after the run. The layer discards
    side effects, but it does not show which bytes an opaque reader used. On
    Linux, an overlay needs a user namespace. Effort: Large.
- **Shared assumptions:**
  - The frozen copy is never writable. Source: the text of option 1C, not a
    user decision. D drops it. Under 1B, the live domain takes its place.
  - The IPC channel stays, and the sidecar accepts only results and phase
    events. Source: `packages/mokly/src/sidecar/postcss-process.ts:44-58`.
  - Environment variables stay inherited, except `TMPDIR` under A. Source:
    `docs/protocol/mokly-sidecar-modules.md:13-24`. An inherited value that
    names a live path, such as a `NODE_OPTIONS` preload, fails under
    confinement unless the domain freezes it.
  - The network works under A. Source: the second options check. This holds
    only when the frozen runtime holds the resolver files and the certificate
    files that inherited variables name.
- **Left out:** A proxy that records network responses fails the goal.
  Native clients can ignore proxy settings, and TLS hides the bytes.
- **Wider fix:** None. The policy is part of the wider fix of decision 1.
- **Previous examples:** PostCSS children keep every inherited variable,
  because consumer settings read them,
  `docs/protocol/mokly-sidecar-modules.md:21-24`.
- **Related:** Waits for decision 1. B needs a live part of decision 2, which
  2E and 2H do not have. E needs a user namespace on Linux, as 3I does.
- **Recommendation:** A. It keeps the user's files unchanged during a run and
  keeps fetch plugins working. This plan first recommended A, and both
  options checks kept A. D and E keep plugins working that write beside their
  sources, but neither gives frozen provenance for changed bytes. C best
  protects the guarantee.
- **Action:** ask the user, because each option changes what plugins can do
  today, and no option is clearly best between compatibility and a stricter
  guarantee.

## Milestone 1: Decisions, documentation, and protocol

Depends on: none

Record the answers, then state the requirements before any product code. Each
changed page gets a status line that links this plan until its behaviour
lands.

- [ ] Record the user's answers with dates. Rewrite the design, the replaced
      ways, and Milestones 2 to 9 for them. All later work waits for these
      answers.
- [ ] If decision 1 is A, change no protocol page. Replace the TODOs of
      Milestones 2 to 8 with no work, and keep Milestone 9, which deletes the
      resolved follow-up item and this plan at completion.
- [ ] Update `docs/protocol/mokly-sidecar-postcss.md`: the domain record
      beside `coverage: "incomplete"`, file-version provenance, the metadata
      rule, the runtime categories, the ancestor configuration names, the
      channels outside file provenance, the stated limits, and the decision
      that replaces the rejection of enforced immutable inputs.
- [ ] Update `docs/protocol/mokly-export.md`: the request option of `build`
      and `publish`, provenance in the input fingerprint, the whole-domain
      check of 1E with its input change for unrelated edits, the replaced
      fingerprint decision, and the rule that the domain proves no global
      atomic snapshot.
- [ ] Update `mokly-imported-styles-postcss.md` for reported inputs and the
      approved list, `mokly-sidecar.md` and `mokly-sidecar-modules.md` for the
      launcher, the namespace, the working directory, and the `TMPDIR`
      override, and `mokly-base-preparation.md` for the base copy, under
      `docs/protocol/`.
- [ ] Add the approved list to `mokly-configuration-imported-styles.md` and
      the diagnostics to `mokly-imported-styles-errors.md`.
- [ ] Update `docs/architecture/rust-core.md`. Split each touched protocol
      page over 250 lines. Run the Markdown check named in `AGENTS.md`. Add
      no budget, quota, gate, or lint, and weaken no test.

## Milestone 2: Launcher and platform proofs

Depends on: 1

- [ ] Add the launcher to `mokly-platform` and its entry to `mokly-cli`, with
      their READMEs: the Linux namespace view of 3I and the macOS Seatbelt
      profile. No command reaches it yet.
- [ ] Prove the Linux namespace obligation first. Then prove the macOS,
      descriptor, runtime, and immutability obligations with fixtures. Record
      which file and metadata accesses each mechanism mediates. Save the logs
      under `.context/confined-postcss-inputs-design/`.
- [ ] Mark each machine class or platform whose proof fails as unavailable in
      the protocol, so that a requested command fails there. Report the
      result to the user.

## Milestone 3: Frozen domain capture

Depends on: 1

- [ ] List the approved sources with nested repositories and submodules, and
      the approved generated inputs. Copy the base extraction into the
      build-private domain.
- [ ] Copy the packages, the ancestor configuration, and the runtime with its
      exact required libraries. Keep the link topology, the metadata view,
      and the stable-capture stamps of each copied entry.
- [ ] Write the immutable manifest with its recorded absences. Map frozen
      paths to logical names. Digest a frozen file only when an inventoried
      input or a final comparison needs it.
- [ ] Stop and reap the processes of a run before its domain is removed.
      Remove a crash leftover only when no owner holds its lease.
- [ ] Add Rust unit tests at the lowest level for membership, nested
      repositories, aliases, the metadata view, mapping, and cleanup.

## Milestone 4: Confined PostCSS contexts

Depends on: 2, 3

- [ ] Add the domain to the `processCss` parameters, and regenerate the
      sidecar types.
- [ ] Start confined children through the launcher in
      `packages/mokly/src/sidecar/postcss.ts`, with frozen paths, the scratch
      folder as `TMPDIR`, and the IPC channel.
- [ ] Return the domain record beside `coverage: "incomplete"`. Keep only
      observed reads in the reads ledger.
- [ ] Add behavioural tests in `tests/sidecar_postcss_*.test.ts` for the
      approved requirements: a content read outside the domain fails, a
      scratch write works, and a live edit leaves the frozen bytes unchanged.
- [ ] Show that each new asynchronous test fails without its behaviour. Then
      run it ten times in a row with the raw commands of
      `docs/protocol/developer-test-commands.md`, and save the logs.

## Milestone 5: Evidence, fingerprint, and caches

Depends on: 4

- [ ] Add file-version provenance and the domain record to
      `mokly-source-interface`, `mokly-render`, and `mokly-static`.
- [ ] Make a conflict between a frozen version and another version of an
      inventoried input an input change before publication.
- [ ] Add the whole-domain check of 1E before publication: membership,
      recorded absence, the metadata view, and content, with exact
      comparisons or the stable-capture contract. Keep it out of catalogue
      membership, protection, public files, and watching.
- [ ] Separate confined results by generation, domain id, runtime identity,
      and policy. Keep cache byte charges apart from domain leases.
- [ ] Test the input-change outcome in `tests/static_postcss_*.test.ts` for a
      live edit of an inventoried input, an unreported approved file, an
      added file, and a new ancestor configuration file during a confined
      run. Test that the manifest and the check add no catalogue member,
      protected input, watch path, or public file.
- [ ] Show that each new asynchronous test fails without its behaviour. Then
      run it ten times in a row, and save the logs.

## Milestone 6: Base side

Depends on: 3, 5

- [ ] Run base PostCSS contexts from the build-private base copy under
      confinement in `mokly-compare` and `mokly-render`.
- [ ] Test that a write into the shared extraction during a confined run
      never changes the confined result. Test base provenance against the
      pinned Git bytes.

## Milestone 7: Request and diagnostics

Depends on: 6

- [ ] Add the request option to `build` and `publish` in `mokly-cli`. Add the
      approved list to `mokly-catalogue` and
      `packages/mokly/config.schema.json`. Update the guides.
- [ ] Fail a requested command when enforcement is unavailable or the
      capture fails, with the diagnostics of Milestone 1. Add the confinement
      line to the diagnostic of a failed confined request.
- [ ] Test the option, the unavailable path, a capture failure, an
      unrequested build, and Serve.

## Milestone 8: Parity, escapes, and cost

Depends on: 7

- [ ] Prove the parity, edit, layout, and base obligations. Report each
      difference to the user as a finding.
- [ ] Add escape tests for absolute live paths, absolute links, inherited
      descriptors, and live edits.
- [ ] Measure capture time, final check time, disk use, and launch time on
      the large React fixture, and report them. The measurement sets no
      limit.
- [ ] Give each new asynchronous test of this milestone its failure proof and
      ten runs in a row. Save the logs.
- [ ] Remove the status lines of the protocol pages.

## Milestone 9: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5, 6, 7, 8

- [ ] Run the targeted tests of each changed area, as `AGENTS.md` names them.
- [ ] Run the early repository suite, `cargo xtask check --suite repository`.
- [ ] Run the complete gate, `cargo xtask check`.
- [ ] Delete `plans/follow-ups/confined-postcss-inputs.md` in the
      implementation commit.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the fix rule: fix the `fix now` findings, record follow-up items
      under `plans/follow-ups/` for the rest, re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls with their dates, a permalink to this plan, and the
      follow-up items that the change adds.
