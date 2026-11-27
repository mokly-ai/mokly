# Blob rows store a content type nobody reads

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 1, check of
  finding 3.
- **Location:** `crates/mkc-store-interface/src/blob.rs:18-19`,
  `crates/mkc-store-pg/src/blob.rs:95-111`,
  `crates/mkc-publications/src/reservation/reserve.rs:119-130`, and
  `crates/mkc-db/migrations/202609162000_publications/up.sql:91`.
- **Reason:** The check found the problem in cloud storage code that the
  branch did not change, and the fix drops a column of a merged schema.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Blob row:** a row of the `blobs` table, one stored copy of one content
    hash in one project.
  - **Publication file row:** a row of the `publication_files` table, one
    path of one publication with its hash and its content type.
  - **Reservation:** the plan step of Mokly Cloud ingest that records each
    path of a publication, with its content type, before the bytes arrive.
- **Background:**
  - At reservation, `crates/mkc-publications/src/reservation/reserve.rs:196-209`
    builds one `PublicationFile` for each declared path, with the type of
    `delivered_content_type` for that path.
  - Lines 210-215 of the same file sort the files by hash, then by path.
    When the project has no blob row for a hash, `reserve_candidates`
    inserts a `Blob` at lines 119-130, with the content type of the first
    file of that hash, through `insert_blob` in
    `crates/mkc-store-pg/src/blob.rs:95-111`.
  - A later publication that reuses the hash does not change that blob row.
    So the type is the type of one path, which can have another extension
    than the other paths of the same bytes.
  - Hosting sends the type of each publication file row:
    `publication_file` in `crates/mkc-store-pg/src/blob.rs:127-154` reads
    `publication_files.content_type`, and
    `crates/mkc-catalogue-server/src/catalogue.rs:243` sends it.
  - A search for `content_type` under `crates/mkc-*` finds no product code
    that reads `Blob::content_type`. `BlobRow` maps the column, and test
    fixtures in about twelve files set the field or copy it into a
    `PublicationFile`.
  - Since 2026-11-25, the reservation test
    `crates/mkc-publications/src/_tests_/reservation_content_type_tests.rs`
    gives two paths one hash: `static/mokly-generated/assets/photo.pjp` and
    `static/notice.txt`. It answers the store with fixed mock answers. It
    asserts the type of each path when the reservation inserts the file row
    of that path: `image/jpeg` and `text/plain; charset=utf-8`. So the test
    fails when a reservation change gives one path the type of another path.
  - Removing `content_type` from the `Blob` struct, and from the `blobs`
    table, also removes the value that a reservation change could copy from
    the first path of a shared hash to another path. Option B removes it from
    the struct, and option C from both.
  - The doc comment of the field says: "Original indexed MIME; serving uses
    each path's MIME."
  - `docs/protocol/cloud/retention.md#reference-accounting` says that files
    that share a hash use one object within a project but keep
    path-specific MIME in their individual index rows. No protocol page gives
    a type to a blob row.
  - The column comes from the merged migration
    `crates/mkc-db/migrations/202609162000_publications/up.sql:91`, as
    `content_type text NOT NULL`. Migrations are append-only, and
    `crates/mkc-db/migration-lock.txt` holds the checksum of each merged SQL
    file, under `crates/mkc-db/README.md`.
- **Problem:** Each blob row stores the type of the first path that reserved
  its hash, and no product code reads it. The field and its doc comment do
  not say that the type belongs to one path only.
- **Impact if no action:** A later change can read the blob type for a path
  with another extension and send the wrong type, because the field looks
  like the type of the bytes. Each new blob row also stores a value with no
  use.
- **Root question:** Which stored record holds the content type of a
  published file?
- **Options:**
  - **A.** Keep the column, and rewrite the doc comment of
    `Blob::content_type`: it holds the type of the first path that reserved
    the hash, and delivery never reads it. Effort: Small.
  - **B.** Keep the column, and remove `content_type` from the `Blob`
    interface struct. `insert_blob` takes the type of the first path as an
    argument, and the row reader stops selecting the column. No migration.
    Effort: Small.
  - **C.** Drop the column with a new forward migration in
    `crates/mkc-db/migrations/`. Its `down.sql` adds the column back and
    fills it from the first publication file row of each hash, by path. Add
    both checksums to `crates/mkc-db/migration-lock.txt`, and regenerate
    `crates/mkc-db/src/schema/publication.rs` with
    `scripts/cloud/db-schema.sh`. Remove the field from `Blob`, `BlobRow`,
    `insert_blob`, `reserve_candidates`, and the test fixtures that set it.
    Effort: Medium.
- **Left out:**
  - Send the blob type for each path: the retention page requires a
    path-specific type, and paths that share a hash can have different
    extensions.
  - Make the column nullable and stop writing it: C is better on every
    point, because both need a migration and only C removes the value.
- **Wider fix:** C. It removes the only stored type that is not the type of
  a path.
- **Previous examples:**
  [asset-resource-plan-variants.md](./asset-resource-plan-variants.md): a
  Mokly asset plan also carries a content type that delivery does not read.
- **Recommendation:** C. It removes a stored value without a reader, and the
  project is not in production. B is the smallest change that keeps the
  field out of the interface.
- **Action:** ask the user, because C drops a column of the schema on
  `origin/main`, and a deletion of schema needs the user's approval.
