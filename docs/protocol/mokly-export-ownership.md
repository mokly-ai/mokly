# Export Ownership v2

## Delivery Status And Boundary

Schema 2 is the approved contract tracked by
[Delta Publishing](../../plans/delta-publishing.md). Until that plan's exporter
milestone lands, the installed CLI still writes schema 1; receivers built
against this document accept only schema 2. The schema 1 shape is retired and
no longer documented.

Every complete [export](./mokly-export.md) contains a regular root file named
`.mokly-export-artifact`. This public inventory is independent of the source
catalogue manifest, the upload envelope and the comparison result. Receivers
read it without importing Mokly's internal modules. In the
[upload exchange](./mokly-upload.md#upload-exchange) it is the content
address list: a receiver learns every file's digest from the marker before any
catalogue bytes are sent and asks only for the digests it does not hold.

## File Contract

The exporter writes UTF-8 JSON without a BOM, with these two fields:

```json
{
  "schemaVersion": 2,
  "files": [
    { "path": "404.html", "sha256": "<64 lowercase hex>", "size": 1834 },
    { "path": "index.html", "sha256": "<64 lowercase hex>", "size": 20991 },
    { "path": "mokly-upload.json", "sha256": "<64 lowercase hex>", "size": 412 }
  ]
}
```

The shortened example illustrates the marker shape, not a complete catalogue.
Its exact field types are:

```ts
interface ExportOwnershipV2 {
  schemaVersion: 2;
  files: ExportOwnershipEntry[];
}

interface ExportOwnershipEntry {
  path: string;
  sha256: string;
  size: number;
}
```

Both root fields are required. The root must be an object; `schemaVersion`
must be the number `2`, and `files` must be an array containing only entry
objects. Each entry requires all three fields:

- `path` is a nonempty slash-separated path relative to the export root, at
  most 1,024 UTF-8 bytes. Reject absolute paths, empty segments, `.`/`..`
  segments, backslashes, colons, NUL and other control characters. Do not list
  `.mokly-export-artifact` itself. Reject repeated paths and paths equal after
  locale-independent Unicode lowercasing (JavaScript
  `String.prototype.toLowerCase`), without Unicode normalization or additional
  case folding. `A.html` and `a.html` collide; `ß.html` and `ss.html` are
  distinct.
- `sha256` is the SHA-256 digest of the file's exact bytes as exactly 64
  lowercase hexadecimal characters. Uppercase, shorter, longer or non-hex
  values are invalid.
- `size` is the file's byte length as an integer from 0 to 67108864 (64 MiB)
  inclusive. Fractional, negative, non-finite, string or larger values are
  invalid. A receiver verifies both the digest and the size of every file it
  stores against the entry.

Readers ignore additional root and entry fields for forward compatibility;
those fields never extend the owned inventory or authorize filesystem
operations. Writers emit only the documented fields, with unique JSON keys.
Whitespace and object-key order do not affect meaning. Upload receivers reject
duplicate JSON keys. Readers do not require sorted entries; writers sort by
`path` using JavaScript's default string sort (UTF-16 code-unit order).

## Complete Artifact And Upload Validation

`files` lists every regular file in the completed export except the marker
itself, including package assets and `mokly-upload.json` when publishing. The
upload envelope is therefore written and hashed before the marker. Directories
are implicit and are not inventory entries. A complete artifact has exactly the
inventory plus the root marker; compare case-sensitive paths as sets after
checking duplicates. File/directory prefix collisions are invalid, including
collisions with the root marker. Inventory order is not significant.

The marker describes generated files; it is not proof of origin or permission
to delete, overwrite, extract, or serve them. Local export recovery can tolerate
missing owned files but rejects unexpected files. The exporter accepts only
schema 2 in an existing output directory: a directory holding a schema 1 marker
from an earlier release fails with an `export-invalid` message naming the
directory to remove. Upload acceptance requires the complete inventory with
neither missing nor unexpected files and every stored blob matching its entry.

Receivers validate the marker before answering a plan request:

| Violation                                                   | Result                           |
| ----------------------------------------------------------- | -------------------------------- |
| `schemaVersion` other than the number `2`                   | 426 `upload-unsupported-version` |
| Malformed root, entry shape, missing or wrongly typed field | 400 or 422 invalid bundle        |
| `sha256` not 64 lowercase hexadecimal characters            | 400 or 422 invalid bundle        |
| `size` outside 0 to 67108864 or not an integer              | 400 or 422 invalid bundle        |
| Repeated, case-colliding, unsafe or marker-owning `path`    | 400 or 422 invalid bundle        |
| Blob bytes whose digest or length differ from the entry     | 400 on that blob                 |
| Complete requested while a listed digest is still missing   | 409 on complete                  |

[Upload limits](./mokly-upload.md#export-files-and-limits) also apply to
every inventory path and file: at most 20,000 regular files including this
marker and the per-file, path and manifest ceilings. The marker uses the
regular-file limit (64 MiB), not the upload envelope's 16 KiB limit. An empty
inventory is a valid marker shape but cannot be a valid upload: `index.html`,
`404.html` and `mokly-upload.json` are required.

## Public Compatibility Fixtures

[The versioned fixture file](./fixtures/export-ownership-v2.json) ships under
`docs/protocol/fixtures` in the npm package. Its root is an object with
`schemaVersion: 1` (fixture format) and `cases`, an array of objects with:

- `name`: a unique case label.
- `valid`: whether the parsed `document` has the ownership marker shape above.
- `document`: the JSON value to validate; serialize it when testing a text parser.
- `rejection`: present only when `valid` is false; `"unsupported-version"` for
  a wrong `schemaVersion` (426) and `"invalid"` for every other rejection
  (400/422).

Cases cover a valid complete inventory, an empty inventory, unsorted entries,
ignored unknown fields, Unicode paths and lowercase-only collisions, then
rejections for schema 1 and other versions, entries missing `path`, `sha256`
or `size`, uppercase or short hex, negative, fractional and over-limit sizes,
duplicate and case-colliding paths, the marker owning itself and every path
grammar rule. They test marker shape, not gzip/tar parsing, raw JSON decoding,
archive completeness, digest verification, authorization or all upload limits.
The packed-consumer smoke checks these installed fixtures with an independent
reader, then verifies an actual published inventory against the stored blobs.
