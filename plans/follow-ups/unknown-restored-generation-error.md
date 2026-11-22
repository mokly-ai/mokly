# Unknown restore reference reports a JSON error

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from review round 4, finding 4, of the branch
  `calummoore/mokly-restored-bundle-reuse-answer-pspj` (#465).
- **Location:** `crates/mokly-sidecar/src/client_origins.rs:44` to line 49
  (`Origins::resolve`), `crates/mokly-sidecar/src/error.rs:141`
  (`ProtocolError`), `crates/mokly-sidecar/src/_tests_/restored_bundle/mod.rs:228`
  to line 233 (`protocol_error`), and
  `crates/mokly-sidecar/src/_tests_/bundle_pool/restored_reply_tests.rs:248`
  to line 251.
- **Reason:** The review found this after the last fix round of #465. The
  performance orchestrator chose on 2026-11-21 to fix it after the merge,
  because the fix changes Rust product code that its final check had
  already measured.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Sidecar:** the Node process that bundles and renders catalogue
    JavaScript for the Rust core.
  - **Restored generation:** a compilation that a `restoreGeneration`
    request installed in one sidecar process.
  - **Short reply:** the `bundle` result `{ generation, restoredGeneration }`.
    It names a restored generation and sends no recipe.
  - **`Origins`:** the private map in `client_origins.rs`. For each sidecar
    process, it records whether each loaded id came from a restore or from a
    bundle, and it keeps `Weak` references to the storage of each restore.
  - **`ProtocolError`:** the enum of malformed-traffic faults in `error.rs`.
    Each fault replaces the sidecar and shows as `sidecar-protocol`.
- **Background:**
  - The `Client` rebuilds each short reply through `Origins::resolve`. It
    fails when the named id is not a live restored generation of that
    process.
  - The "Restored reuse" section of `docs/protocol/mokly-sidecar-recipes.md`
    calls such a reply a malformed frame that fails with `sidecar-protocol`.
  - `Error::diagnostic` in `crates/mokly-sidecar/src/presentation.rs:19`
    puts the `ProtocolError` text in the build output.
  - No code branches on the variant of a `ProtocolError`. So a new variant
    changes no class and no recovery.
- **Problem:**
  - `Origins::resolve` builds a `serde_json::Error` with
    `de::Error::custom(format!("unknown restored generation {}", ...))` and
    wraps it in `ProtocolError::Json`.
  - The frame is valid JSON, but the build output says "invalid JSON frame:
    unknown restored generation ...".
  - The error rules of the shared `rust` skill forbid `format!` for an error
    at a call site, and faults that only a string tells apart.
  - The tests match only `ProtocolError::Json { .. }`, which every payload
    parse failure also matches. So no test pins this fault.
- **Impact if no action:** A rare protocol fault names a wrong cause in the
  build output, and a change that breaks this rejection can pass the tests if
  it fails with any other JSON error.
- **Root question:** How does the core report a short reply that names no
  restored generation of its process, so that the fault, its message, and
  its tests name that cause?
- **Options:**
  - **A.** Change nothing. The `sidecar-protocol` class and the worker
    replacement are already correct. Effort: Small.
  - **B.** Add `ProtocolError::UnknownRestoredGeneration { generation: String }`
    with the message "bundle result names unknown restored generation
    {generation}". `Origins::resolve` returns it without `format!` and
    without a `serde_json` error. The `protocol_error` test helper and the
    pool test in `restored_reply_tests.rs` assert the variant and the id.
    Effort: Small.
  - **C.** Resolve the reference inside the decoder with a
    `DeserializeSeed` that carries `Origins`. An unknown id then becomes a
    real payload decode error, and `ProtocolError::Json` becomes correct.
    The fallback through a generic JSON tree must carry the same seed.
    Effort: Medium.
- **Left out:**
  - A string variant such as `ProtocolError::Other(String)`: the `rust` skill
    forbids a generic catch-all.
  - An error enum local to `client_origins.rs` that converts into
    `Error::Protocol`: B is simpler, and the `rust` skill keeps `#[from]` for
    the internal fallback only.
- **Wider fix:** None. The error rules of the shared `rust` skill already
  require specific variants.
- **Previous examples:** None found.
- **Recommendation:** B. It names the fault exactly, keeps every recovery
  rule, and lets the tests assert the variant and the id.
- **Action:** fix after merge, apply B, as the performance orchestrator chose
  on 2026-11-21.
