# Use one content type rule for delivered assets

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: the wider fix of review finding 2 of round 1.
- **Location:** `crates/mokly-server/src/assets.rs:136-155`,
  `crates/mkc-publications/src/reservation/reserve.rs:204`, and
  `crates/mokly-css/src/imported_assets.rs:43-67`.
- **Reason:** The fix changes a Mokly Cloud crate and the types that Serve sends
  for authored files, so it needs its own branch and review.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Content type:** the media type that a server sends with a file, such
    as `image/jpeg`. The browser uses it to decide how to show the file.
  - **JavaScript asset table:** the list of extensions and content types in
    `crates/mokly-css/src/imported_assets.rs`, which
    `docs/protocol/mokly-imported-assets.md` specifies for files that
    JavaScript imports.
  - **Authored file:** a public file of the repository that a document links
    by a relative path, outside `static/mokly-generated/`.
- **Background:**
  - Serve finds the type of a generated asset with `generated_content_type`
    in `crates/mokly-server/src/assets.rs`, which reads the JavaScript asset
    table first and `mime_guess` second. `content_type` in the same file
    reads the table only for paths that start with
    `static/mokly-generated/assets/`, and `mime_guess` for every other path.
  - Since 2026-11-21, the edited preview of a component uses the same lookup
    as Browse, so Serve sends one type for each generated asset.
  - Mokly Cloud stores a type for each published file with
    `mime_guess::from_path`, and it serves that stored type. The call is at
    `crates/mkc-publications/src/reservation/reserve.rs:204`.
  - `mime_guess` 2.0.5 gives `application/octet-stream` for `.pjp`,
    `.pjpeg`, and `.cur`. It gives other types than the tables for `.ico`,
    `.m4a`, `.otf`, and `.woff`.
- **Problem:** The same generated asset gets one type in Serve and another
  type in Mokly Cloud. A `.pjp` image opens as an image in Serve and
  downloads as a generic file from a published catalogue.
- **Impact if no action:** Published catalogues show some imported images,
  fonts, and media with a wrong type. Each publication before the fix keeps
  its stored wrong types.
- **Root question:** Which one rule gives the content type of a delivered
  asset, so that every delivery path sends the declared type for any path
  form?
- **Options:**
  - **A.** Use the asset tables in the Cloud publication path, with its own
    test of the generated path forms. Each caller still recognizes generated
    paths separately. Effort: Small.
  - **B.** Share one lookup for generated asset paths across Serve, comparison
    snapshots, and Cloud publication. The lookup must know each generated
    path form, also the snapshot copies under
    `mokly-viewer/diffs/generations/{generation}/snapshots/{side}/mokly-generated/assets/`.
    Effort: Medium.
  - **C.** Carry the declared type in the publication file inventory. This
    changes the upload format and needs a new validation rule. Effort: Large.
  - **E.** One rule by file extension for each file that Serve or the Cloud
    delivers: the asset tables first, then `mime_guess`. Remove
    `generated_content_type` and the path prefix test in `content_type`. The
    Cloud reservation calls the same table as a documented export, for
    example from `mokly-model`, because `mokly-css` brings in `lightningcss`.
    Authored `.ico`, `.otf`, `.woff`, `.m4a`, `.cur`, `.pjp`, and `.pjpeg`
    files then get new types in Serve, and authored `.vtt` files lose their
    charset parameter. Effort: Medium.
  - **F.** The render generation gives the declared type with each generated
    resource, through a change of the `GeneratedResources` trait and its
    implementors. It does not help the Cloud, which receives only the static
    output. Effort: Medium.
- **Left out:**
  - Keep a filename guess alone: it cannot give `image/jpeg` for `.pjp`.
  - Remove `.pjp`, `.pjpeg`, and `.cur` from the table: this drops types that
    Vite delivers, and `.ico`, `.otf`, `.woff`, and `.m4a` still differ.
  - Let `build` write a host configuration file: the static delivery contract
    in `docs/protocol/mokly-export-delivery.md` leaves types to the host.
  - Give the Cloud its own copy of the table: the copy can drift.
- **Wider fix:** E. It depends only on the file extension, so a new path form
  cannot escape it.
- **Previous examples:** The preview fallback of commit `9c56286d` gave
  `image/x-icon` for `.ico`, while the stylesheet asset contract declares
  `image/vnd.microsoft.icon`.
- **Related:** [asset-resource-plan-variants.md](asset-resource-plan-variants.md)
  drops the unread content type of asset plans. It must follow the rule that
  this item chooses.
- **Recommendation:** E. One rule then gives every delivery path the same type,
  also for authored files and published catalogues.
- **Answer:** The user chose option E on 2026-11-25. One rule by file extension,
  the asset tables first and then `mime_guess`, gives the content type on every
  delivery path, and the Mokly Cloud reservation calls the same exported table.
- **Action:** fix after merge, apply E, because the user approved the change to
  Serve and to Mokly Cloud on 2026-11-25.
- **Done when:** the status lines of `docs/protocol/mokly-imported-assets.md`
  and `docs/protocol/mokly-imported-styles-assets.md` are gone, because Mokly
  Cloud sends the content types of the asset tables and of a delivered
  `.txt` asset.
