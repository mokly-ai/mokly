# Publication Upload Validation

Status: The receiver does not run the content check yet. It checks only the index fields that its own features read, and it reads no entry detail. The [receiver read-model validation item](../../../plans/follow-ups/receiver-read-model-validation.md) adds the check.

This document defines how the receiver validates the plan request of the
[upload exchange](./publication-upload-exchange.md): the plan archive's
framing and quotas, the schema 3 ownership marker and the catalogue index.
The quotas and the hosting policy apply to the declared
catalogue. Catalogue file bytes arrive later as blob requests and are checked
against these declarations.

## Plan Archive And Limits

Authenticate before decompression. Authentication, HTTP framing, repository
authorization, deadlines and request concurrency are the API's responsibility,
not the validator's. Reject a declared Content-Length above the compressed
limit immediately; the reader also enforces it for chunked or dishonest
requests.

| Limit                                                                   | Inclusive maximum |
| ----------------------------------------------------------------------- | ----------------- |
| Compressed plan request bytes                                           | 100 MiB           |
| Decompressed plan bytes, including tar headers/padding                  | 512 MiB           |
| Regular file bytes, archived or declared                                | 64 MiB            |
| Archived regular files scanned before the exact-set check               | 60,000            |
| Declared marker entries, excluding the marker itself                    | 59,999            |
| Sum of all declared file sizes (receiver quota)                         | 6 GiB             |
| Upload envelope bytes                                                   | 16 KiB            |
| Ownership marker bytes (receiver quota)                                 | 64 MiB            |
| Catalogue index bytes (receiver quota)                                  | 64 MiB            |
| JSON nodes per artifact, including object keys (receiver quota)         | 4,194,304         |
| Simultaneously retained JSON key digests (receiver quota)               | 65,536            |
| Nested JSON values, counting the root as level 1 (receiver quota)       | 256               |
| Every archived, declared, config or index entry path                    | 1,024 UTF-8 bytes |
| Segments per path (receiver quota)                                      | 64                |
| Distinct archive prefixes, including files/directories (receiver quota) | 262,144           |

Limits are checked before allocating or reading an entry body. Quotas may be
lowered, never raised above these values. Each artifact must fit both the
regular-file limit and its own quota. The file-count and declared-size quotas
leave more than twice the room of the largest real catalogue build measured,
a pull-request build of 26,070 files and 2,580 MB. The declared-size quota is
separate from the decompressed plan limit, because the plan archive holds only
its three artifacts and the other declared files arrive as blobs. The prefix
quota leaves room for 60,000 files and their directories. The node quota
covers a 64 MiB index at the node density of real catalogues and bounds the
memory of one parse. The 256-level depth limit is chosen so that the complete
64-level tagged component-prop codec fits.

Decision: the ownership marker and catalogue index quotas equal the 64 MiB
regular-file limit. A higher quota was rejected, because the CLI, the
receiver, the file stores and the database each cap a file at 64 MiB. The
marker quota holds 59,999 entries of typical length. A marker with
maximum-length paths reaches the byte quota at a lower entry count.

The memory of derived path sets, not only byte counters, is bounded by these
limits.
Segment or prefix quota excess is HTTP 413. Finish bounded scanning before
reporting envelope, version or structural errors, so an observable limit
violation takes precedence. Never decompress beyond a detected limit.

Require valid gzip checksum/length, valid USTAR checksums, complete bodies,
two zero end blocks and only zero tar padding thereafter. Reject additional
gzip members or trailing compressed bytes. Only regular files and directories
are scanned; reject links, devices, FIFO, sparse and other special entries.
PAX may override `path` and decimal `size`; ordinary `mtime`, `atime`, `ctime`,
`uid`, `gid`, `uname`, `gname`, `comment` and `charset` metadata is ignored.
Reject other keys and duplicate keys within a PAX record. Local PAX applies to
the next entry; global PAX applies until overridden. A trailing unconsumed local
PAX header is invalid.

Paths must be nonempty UTF-8, with no control characters, backslash, colon,
absolute prefix, empty segment, or `.`/`..` segment. Collision keys use Unicode
lowercase without normalization or extra case folding, matching JavaScript
`toLowerCase` (including contextual sigma). Directory prefixes may differ in
spelling, such as `A/x` beside `a/y`. Repeated full file paths, full file paths
equal after lowercasing and file/directory prefix conflicts are invalid.

The archive must contain exactly the regular files `mokly-upload.json`,
`.mokly-export-artifact` and `mokly-viewer/index.json`. Order is
not significant. A directory record or any other file is invalid. Node,
retained-key and depth excesses are HTTP 413 before typed decoding. The
envelope, the marker and the index reject a BOM and duplicate keys at every
nesting level.

## Ownership Marker

The marker uses integer `schemaVersion: 3`.
It is UTF-8 JSON with `files`, one `{ "path", "sha256", "size" }` entry per
regular export file except the marker. Unknown fields are ignored and never
grant ownership. Classification
follows the released order:

After bounded JSON preflight, require an object root before probing its version.
An array such as `[4]` is an invalid bundle, not an unsupported version.

1. A present `schemaVersion` other than the integer 3, including the string
   `"3"`, is HTTP 426 before `files` is read. Schemas 1 and 2 are unsupported.
2. The root and entries require object syntax; positional arrays are invalid.
   A missing version or `files`, a non-array `files`, or a wrongly typed root
   field is HTTP 400. The receiver caps the entry count at 59,999 with 413.
3. Classify entries in source order. Require each object, its three primitive
   fields and an integer numeric `size` first. Then check its path and size
   limits, with 413 for excess. Then reject negative sizes, bad digests and
   path grammar with 400. A fractional size is a type failure before that
   entry's limits. Refuse an entry equal to `.mokly-export-artifact` here,
   after its limits. A malformed earlier entry wins over a later limit failure.
4. After every entry passes, reject duplicate full paths, full paths equal
   after JavaScript `toLowerCase` and file/directory prefix conflicts with 400. Include the marker in this namespace. Directory spelling alone does
   not collide.

The envelope is probed for its version before the marker is decoded, so an
unsupported envelope wins with HTTP 426. Entries need not be sorted. The
marker must declare `index.html`, `404.html`, `mokly-upload.json` and
`mokly-viewer/index.json`. The archived envelope and index must
equal their declared digest and size. The server computes and
stores the marker itself.

## Hosting Policy

Declared paths follow the policy that served catalogues need. The source
`mokly-manifest.json` is forbidden at any depth, including
`static/mokly-generated/mokly-manifest.json`.
Reject dotfiles except the root marker, TS/TSX/JSX, source maps and config
modules. Comparison diagnostics under `mokly-viewer/diffs/**/summary.md`
are private. Decision: the `mokly-manifest.json` and `summary.md` rules stay,
although 0.19.0 writes neither file, because they still refuse private
metadata in every upload. Removing them was rejected, because they cost
nothing and a receiver cannot trust the producer. Hosting accepts
`node_modules` segments. Decision: that segment is accepted because the
released imported-asset and public-files contracts place generated assets and
entry paths under it; the policy still excludes source and config files,
private metadata, files outside the validated inventory and paths that break
the ordinary path rules. Root
`_access` and `__blobs` trees are reserved for catalogue authentication and
immutable blob URLs. Fixed Mokly deployed segments have no `_` prefix, so
they cannot collide with these roots, and other underscore-prefixed authored
segments are subject only to the ordinary path rules. Unknown public assets
are allowed. This is a hosting policy, matched without case sensitivity, not
HTML sanitization or proof that arbitrary assets contain no secrets.

The root `__mokly` and its descendants cannot be served. Reject them at plan
validation with 400 `upload-invalid-bundle`, including in current-only plans.

## Comparison Validation

`baseRef` and `baseSha` are both null or both present. An upload has a
comparison exactly when `baseSha` is present.

With a comparison, the index carries `changesStatus: "ready"`, a `baseCommit`
equal to the envelope's `baseSha` and a `base` equal to the envelope's
`baseRef`. Its `comparisonUrl` is
`mokly-viewer/diffs/generations/<64 lowercase hex>/`, which names the
comparison generation. Every declared path under
`mokly-viewer/diffs/` lies within that generation. No other
comparison namespace or alias is accepted.

Without a comparison, the index carries no `baseCommit`, a null
`comparisonUrl` and a `changesStatus` of `disabled` or `unavailable`.
Such an upload declares no `mokly-viewer/diffs` path. Any
disagreement between the envelope and the index is HTTP 400
`upload-invalid-bundle`.

[Publication index](./publication-review.md) defines the content check and the
Changes count. The receiver validates the relationships that the envelope, the
index and the declarations prove. The
[content check](../mokly-upload-validation.md#catalogue-content) applies the
rules of the core readers to the index and every entry detail. Changes
attribution and CSS matches stay producer checks. Retain the received bytes;
never claim producer authenticity or invent evidence.
