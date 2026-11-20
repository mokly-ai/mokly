# Windows PostCSS witnesses drop their resolved names

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the options check of the Windows capture
  device, on branch `calummoore/lisbon-h906`. The check listed it as an
  observation outside the scope.
- **Location:** `packages/mokly/src/sidecar/postcss-file-identity.ts:15` to
  line 27, `crates/mokly-source-interface/src/identity_evidence.rs:18` to
  line 27, `crates/mokly-render/src/source_evidence.rs:39`, and
  `crates/mokly-static/src/fingerprint_evidence.rs:72`.
- **Reason:** The defect predates the bundle disk cache change on `main`, and
  its fix changes the PostCSS read witness, which that change does not touch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Read witness:** a record that a PostCSS child returns for a file read:
    the absolute path, the SHA-256 digest of the delivered bytes, and an
    optional file identity.
  - **File identity:** the `object` text `{dev}:{ino}` of the open
    descriptor that supplied the bytes, and an optional `canonical` resolved
    name.
  - **Affected runtime:** a Node version that bundles libuv 1.49.x or
    1.50.x: Node 22.14.0 to 22.16.0, and Node 23.11.0 to 24.1.0.
  - **Path stat and handle stat:** a stat by name, such as `fs.statSync`,
    and a stat of an open descriptor, such as `fs.fstatSync`.
- **Background:**
  - The section "Read Evidence" of `docs/protocol/mokly-sidecar-postcss.md`
    says: "When available, each witness retains the native identity of the
    descriptor that supplied its bytes. Keep a resolved name only when its
    metadata matches that open descriptor. Equal bytes cannot hide a changed
    target." The same section says that observation does not raise the
    supported Node minimum.
  - `fileIdentity` at `packages/mokly/src/sidecar/postcss-file-identity.ts:10`
    takes `object` from `fs.fstatSync` of the descriptor. It sets `canonical`
    to `fs.realpathSync.native(file)` only when `fs.statSync` of that name
    reports the same `dev` and `ino`.
  - libuv 1.49.x and 1.50.x declare their private copy of
    `FILE_STAT_BASIC_INFORMATION` with two fields in the wrong order.
    Windows 11 24H2 and Windows Server 2025 export
    `GetFileInformationByName`, so libuv takes a fast route for the path
    stat of an object that is not a reparse point. That route reads the
    device from the upper half of the 128-bit file ID, which is 0 on NTFS.
    libuv 1.51.0 fixed the order through libuv/libuv#4696 and
    libuv/libuv#4698. A handle stat queries the volume serial on the open
    handle in every version.
  - On 2026-11-17, a diagnostic on the Windows Server 2025 CI runner read
    `package.json` with Node 22.15.0. Every path stat variant reported
    device 0. The handle stat reported the volume serial 1383836831, with
    the same inode and stamps. Node 24.22.1 reported the serial in both
    routes.
  - So on an affected runtime on those Windows versions, the two `dev`
    values of `fileIdentity` never agree for a file on NTFS, and `canonical`
    is never set. On ReFS, the path value is part of a file ID, so the
    values almost never agree either. Windows 10 and Windows Server 2022 do
    not export `GetFileInformationByName`, so the name check works there.
  - `matches` at `crates/mokly-source-interface/src/identity_evidence.rs:18`
    accepts a witness when the path still projects to a node, the current
    file object of that node equals `object`, and `canonical` is absent or
    equals the identity of the node. Without `canonical`, it skips the name
    comparison. Its `comparable` helper strips a verbatim prefix before that
    comparison. `plans/follow-ups/verbatim-prefix-helpers.md` covers that
    helper.
  - Two callers use `matches`:
    - `crates/mokly-render/src/source_evidence.rs:39` decides whether a
      pinned base read stays valid. An invalid identity passes no current
      digest to `observe_pinned_input`.
    - `crates/mokly-static/src/fingerprint_evidence.rs:72` reports
      `InputsChanged` for a static build when an identity no longer matches.
  - Both callers still compare the object identity and the digests of the
    delivered bytes.
  - On 2026-11-17, the bundle disk cache change fixed the same cause for its
    capture witnesses. On Windows, `captureSnapshot` in
    `packages/mokly/src/sidecar/capture-runtime.ts` takes each capture
    witness from a handle stat.
- **Problem:** On an affected runtime on Windows 11 24H2 or Windows Server
  2025, a PostCSS read witness never keeps its resolved name. The two callers
  then check only the object identity and the digests.
- **Impact if no action:** On those systems, both callers accept a read whose
  path now resolves to another name of the same file object. Other systems
  report that read as changed. No test, run, or report shows a different
  stylesheet output from this, because the object identity and the digests
  still bind the delivered bytes.
- **Root question:** How does a PostCSS read witness keep its verified
  resolved name on every supported Node version on Windows?
- **Options:**
  - **A.** Change nothing. The name check stays off on affected runtimes on
    those Windows versions. Effort: Small.
  - **B.** Check the resolved name through a handle. Open the resolved name
    read-only, take `fs.fstatSync` of it, compare its `dev` and `ino` with the
    descriptor, and close it. Keep the name only when both agree. Both sides
    then use the handle route, as the capture witnesses do. It adds one open
    for each witness with an identity. Add one unit case with an injected
    path device of 0. Effort: Small.
  - **C.** Raise the supported Node floor to 22.17.0 and 24.2.0. It removes
    every affected runtime. It changes the engines fields, the CI pins, and
    the documented minimum, and the PostCSS page says that observation does
    not raise the supported minimum. So it needs the user. Effort: Medium.
- **Left out:**
  - A name check by `ino` alone. Two volumes can hold equal file IDs, so it
    weakens the identity rule.
  - A name check that accepts device 0. Device 0 carries no volume, and on
    ReFS the path value is part of a file ID.
- **Wider fix:** C removes the class for every path device in the package.
  It changes a requirement, so it needs the user. B is the best option that
  is not blocked.
- **Previous examples:** The capture witnesses of the bundle disk cache,
  fixed on 2026-11-17. On Windows, `captureSnapshot` in
  `packages/mokly/src/sidecar/capture-runtime.ts` takes each witness from a
  handle stat.
- **Recommendation:** B. It restores the name check of the protocol on every
  supported runtime with a small change in one function.
- **Action:** fix after merge, apply B, because the defect predates the
  bundle disk cache change on `main`, and the object identity and the
  digests still bind the delivered bytes.
