# Mount directory never matches its volume root

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from item 2 of the options check of the Windows
  capture device, on branch `calummoore/lisbon-h906`.
- **Location:** `packages/mokly/src/sidecar/capture-volumes.ts:41` to line 46,
  and `crates/mokly-platform/src/volumes/windows.rs:59` to line 81.
- **Reason:** The defect fails closed and keeps the output correct, and the
  fix rule sends a Rare product bug of Low severity after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Bundle cache:** the OS cache kind that keeps the latest compiled bundle
    of each set of bundle settings for later processes.
  - **Capture witness:** a stat record of one directory or metadata file. The
    sidecar keeps it from the first touch until after the compile, to prove
    that the reuse evidence stayed stable.
  - **Capture hint:** the private `capture` field of the sidecar `hello`
    request. On Windows, it lists each fixed NTFS or ReFS volume with its
    serial number and its mount roots.
  - **Mounted folder:** an empty NTFS directory where Windows mounts another
    volume, such as `C:\mnt\data`.
- **Background:**
  - The bundle cache stores a compilation only when its reuse evidence is
    complete and stable. The section "Stable Capture" of
    `docs/protocol/mokly-base-cache.md` supports NTFS and ReFS on a fixed
    Windows volume. The protocol stays as it is.
  - The sidecar witnesses each directory in the ancestor walk of every
    observed path. Each witness must lie on a supported volume, or the
    bundle cache does not store the compilation.
  - `crates/mokly-platform/src/volumes/windows.rs:59` to line 81 reads the
    mount roots of each volume with `GetVolumePathNamesForVolumeNameW`.
    Windows returns a drive root such as `C:\`, and a mounted folder with a
    final backslash, such as `C:\mnt\data\`.
  - `CaptureVolumes.supported` at
    `packages/mokly/src/sidecar/capture-volumes.ts:31` matches a Windows path
    against the roots of the hinted volume whose serial equals the witness
    device. `localWindowsPath` lowercases and normalizes both sides.
    `path.win32.normalize` keeps the final backslash of a root.
  - Lines 44 to 45 accept a path only when it equals the root, or when it
    starts with the root and a backslash. The ancestor walk visits the mount
    directory as `c:\mnt\data`, without a final backslash. So neither test
    matches it: `c:\mnt\data` differs from `c:\mnt\data\`, and it does not
    start with `c:\mnt\data\`.
  - A path below the mount directory, such as `c:\mnt\data\src`, matches. A
    drive root such as `c:\` matches itself.
  - Since 2026-11-17, each Windows witness takes its device from a handle
    stat. A handle stat of the mount directory describes the root of the
    mounted volume, so the witness device is the serial of that volume.
  - Every walk under the mounted volume visits the mount directory. So no
    compilation in that volume is stored. Mokly prints nothing, and the
    output stays correct.
- **Problem:** A hinted mount root with a final backslash never matches its
  own mount directory. So a project on a volume mounted in a folder never
  gets a stored compilation.
- **Impact if no action:** Such a project compiles again at each start. The
  bundle cache gives it no gain, and nothing tells the user why.
- **Root question:** How does a hinted mount root match both its own
  directory and the paths below it?
- **Options:**
  - **A.** Compare the selected path also with the root without its final
    backslash, and keep the prefix test. Keep a drive root such as `c:\` as
    it is. Add one unit case for the mount directory itself and one for a
    path below it. Effort: Small.
  - **B.** Change nothing. Mounted folders stay not stored and fail closed,
    although the protocol lists their volumes as supported. Effort: Small.
- **Left out:** Removing the final backslash of each mounted folder in
  `crates/mokly-platform` before the hint. It moves the same rule into the
  hint producer, and the sidecar comparison then still depends on one root
  form. A is better on every point.
- **Wider fix:** A. One comparison then serves every root form that Windows
  supplies.
- **Previous examples:** None found.
- **Recommendation:** A. It meets the documented support of fixed NTFS and
  ReFS volumes with a small change in one comparison.
- **Action:** fix after merge, apply A, because the defect fails closed and
  keeps the output correct, and the fix rule sends a Rare product bug of Low
  severity after the merge.
