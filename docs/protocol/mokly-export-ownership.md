# Export Ownership v3

## Delivery Status And Boundary

Schema 3 is implemented by the exporter and every local ownership reader.
[Delta Publishing](../../plans/delta-publishing.md) records the completed
exporter, CLI and receiver-side compatibility work. Receivers built against
this document accept only schema 3. Schemas 1 and 2 are unsupported. Version 3
retains v2 digests and limits while gating the new `mokly-viewer/` paths.

Every complete [export](./mokly-export.md) contains a regular root file named
`.mokly-export-artifact`. This public inventory is independent of the source
catalogue manifest, the upload envelope and the comparison result. Receivers
read it without importing Mokly's internal modules. In the
[upload exchange](./mokly-upload-exchange.md#upload-exchange) it is the content
address list: a receiver learns every file's digest from the marker before any
catalogue bytes are sent and asks only for the digests it does not hold.

## File Contract

The exporter writes UTF-8 JSON without a BOM, with these two fields:

```json
{
  "schemaVersion": 3,
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
interface ExportOwnershipV3 {
  schemaVersion: 3;
  files: ExportOwnershipEntry[];
}

interface ExportOwnershipEntry {
  path: string;
  sha256: string;
  size: number;
}
```

Both root fields are required. The root must be an object. A missing
`schemaVersion` is invalid. Any present value other than the number `3`,
including string `"3"`, is an unsupported version; readers classify it before
inspecting `files`. For version 3, `files` is an array containing only entry
objects. Each entry requires all three fields:

- `path` is nonempty, slash-separated and relative to the export root, with at
  most 1,024 UTF-8 bytes. It must be well-formed Unicode: encoding as UTF-8 and
  decoding must preserve the same string. Reject Unicode category Cc
  characters (U+0000–U+001F and U+007F–U+009F), a leading `/`, backslashes,
  colons, and empty, `.` or `..` segments. Format characters such as U+200D
  are allowed. Do not list `.mokly-export-artifact` itself.
- Reject repeated paths, paths equal after JavaScript
  `String.prototype.toLowerCase()`, and file/directory prefix collisions after
  the same lowercasing. Prefix comparison includes the marker path: `a` beside
  `a/b`, `A` beside `a/b`, or `.mokly-export-artifact/child` is invalid. Do not
  normalize Unicode or apply additional case folding. `A.html` and `a.html`
  collide; `ß.html` and `ss.html` are distinct.
- `sha256` is the SHA-256 digest of the file's exact bytes as exactly 64
  lowercase hexadecimal characters. Uppercase, shorter, longer or non-hex
  values are invalid.
- `size` is the file's byte length as an integer from 0 to 67108864 (64 MiB)
  inclusive. Fractional, negative, non-finite or nonnumeric values are invalid.
  A larger integer is well-formed but exceeds the upload limit. A receiver
  verifies both the digest and size of every stored file against the entry.

Readers ignore additional root and entry fields for forward compatibility;
those fields never extend the owned inventory or authorize filesystem
operations. Writers emit only the documented fields, with unique JSON keys.
Whitespace and object-key order do not affect meaning. Upload receivers reject
duplicate JSON keys. Readers do not require sorted entries; writers sort by
`path` using JavaScript's default string sort (UTF-16 code-unit order).

Classification order is deterministic. Check a present root version before
`files`. For version 3, require each field's documented primitive type, then
classify an integer size above 64 MiB or a string path above 1,024 UTF-8 bytes
as too large before applying the remaining entry grammar. Wrong field types,
including a nonnumeric size or non-string path, remain invalid.

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
schema 3 in an existing output directory. A regular marker that parses as
invalid, too large or unsupported, including an earlier version, fails with
`[mokly/export-invalid] Invalid export ownership inventory.` Missing ownership
and unsafe filesystem entries retain their separate errors. There is no
version-specific local recovery path. Before clearing a destination manually,
move any files that must be kept. Upload acceptance requires the complete inventory with
neither missing nor unexpected files and every stored blob matching its entry.

Receivers validate the marker before answering a plan request:

| Violation                                                           | Result                           |
| ------------------------------------------------------------------- | -------------------------------- |
| Present `schemaVersion` other than the number `3`                   | 426 `upload-unsupported-version` |
| Malformed root, missing version, entry shape or wrongly typed field | 400 or 422 invalid bundle        |
| `sha256` not 64 lowercase hexadecimal characters                    | 400 or 422 invalid bundle        |
| `size` negative, fractional, non-finite or nonnumeric               | 400 or 422 invalid bundle        |
| Integer `size` above 67108864 or `path` above 1,024 UTF-8 bytes     | 413 `upload-too-large`           |
| Repeated, case-colliding, prefix-colliding or unsafe `path`         | 400 or 422 invalid bundle        |
| Blob bytes whose digest or length differ from the entry             | 400 on that Blob                 |
| Complete requested while a listed digest is still missing           | 409 on Complete                  |

[Upload limits](./mokly-upload-validation.md#export-files-and-limits) also apply to
every inventory path and file: at most 20,000 regular files including this
marker and the per-file, path and manifest ceilings. The marker uses the
regular-file limit (64 MiB), not the upload envelope's 16 KiB limit. An empty
inventory is a valid marker shape but cannot be a valid upload: `index.html`,
`404.html` and `mokly-upload.json` are required.

## Public Compatibility Fixtures

[The versioned fixture file](./fixtures/export-ownership-v3.json) ships under
`docs/protocol/fixtures` in the npm package. Its root is an object with
`schemaVersion: 1` (fixture format) and `cases`, an array of objects with:

- `name`: a unique case label.
- `valid`: whether the parsed `document` has the ownership marker shape above.
- `document`: the JSON value to validate; serialize it when testing a text parser.
- `rejection`: present only when `valid` is false; `"unsupported-version"` for
  a present version other than number 3 (426), `"too-large"` for an over-limit
  integer size or path byte length (413), and `"invalid"` for every other
  rejection (400/422).

Cases cover a valid complete inventory, an empty inventory, unsorted entries,
ignored unknown fields, Unicode paths, an accepted U+200D, and a path of
exactly 1,024 UTF-8 bytes. Rejections cover a missing version, schema 1, string
`"3"` and other versions; missing entry fields; uppercase or short hex;
negative, fractional, nonnumeric and over-limit sizes; duplicate, case and
exact/case-folded prefix collisions; marker ownership; invalid Unicode; DEL,
U+0085 and other category Cc characters; a multibyte path over 1,024 bytes;
and every other path grammar rule.
They test marker shape, not gzip/tar parsing, raw JSON decoding, archive
completeness, digest verification, authorization or all upload limits. The
packed-consumer smoke checks these installed fixtures with an independent
reader, then verifies an actual published inventory against the extracted bytes.

The approved [refusal contract](./mokly-boundary-results.md#export-refusals)
names the output folder in every refusal and lists unexpected files when known.
It adds no adoption or upgrade path and preserves every existing file.
