# Export Ownership v1

## File Contract

Every complete [export](./mokly-export.md) contains a regular root file named
`.mokly-export-artifact`. This public inventory is independent of the source
catalogue manifest, the upload envelope and the comparison result. Receivers
can read it without importing Mokly's internal modules. The reader-facing
[export files guide](../guides/reference/export-files.md) restates these rules
for integrators and changes with them.

The exporter writes UTF-8 JSON without a BOM, with these two fields:

```json
{
  "schemaVersion": 1,
  "files": ["404.html", "index.html", "mokly-upload.json"]
}
```

The shortened example illustrates the marker shape, not a complete catalogue.
Its exact field types are:

```ts
interface ExportOwnershipV1 {
  schemaVersion: 1;
  files: string[];
}
```

Both fields are required. The root must be an object; `schemaVersion` must be
the number `1`, and `files` must be an array containing only strings. Readers
ignore additional fields for forward compatibility; those fields never extend
the owned inventory or authorize filesystem operations. Writers emit only the
two documented fields, with unique JSON keys. Whitespace and object-key order
do not affect meaning. Upload receivers reject duplicate JSON keys.

Each `files` item is a nonempty slash-separated path relative to the export
root. Reject absolute paths, empty segments, `.`/`..` segments, backslashes,
colons and NUL. Do not list `.mokly-export-artifact` itself. Reject repeated
paths and paths equal after locale-independent Unicode lowercasing (JavaScript
`String.prototype.toLowerCase`), without Unicode normalization or additional
case folding. For example, `A.html` and `a.html` collide; `ß.html` and `ss.html`
are distinct. Readers do not require sorted paths; writers use JavaScript's
default string sort (UTF-16 code-unit order).

## Complete Artifact And Upload Validation

`files` lists every regular file in the completed export except the marker
itself, including package assets and `mokly-upload.json` when publishing.
Directories are implicit and are not inventory entries. A complete artifact
has exactly the inventory plus the root marker; compare case-sensitive paths
as sets after checking duplicates. File/directory prefix collisions are invalid,
including collisions with the root marker. Inventory order is not significant.

The marker describes generated files; it is not proof of origin or permission
to delete, overwrite, extract, or serve them. Local export recovery can tolerate
missing owned files but rejects unexpected files; upload acceptance requires
the complete inventory with neither missing nor unexpected files.

[Upload v1 validation and limits](./mokly-upload.md#validation-and-limits) also
apply to every inventory path and file: valid UTF-8, no control characters,
at most 1,024 path bytes, at most 20,000 regular files including this marker,
and all archive/file byte ceilings. The marker uses the regular-file limit
(64 MiB), not the upload envelope's 16 KiB limit. An empty inventory is a valid
marker shape but cannot be a valid upload: `index.html`, `404.html` and
`mokly-upload.json` are required. An unsupported ownership version is an invalid
bundle (400/422); 426 is reserved for the upload envelope's `schemaVersion`.

## Public Compatibility Fixtures

[The versioned fixture file](./fixtures/export-ownership-v1.json) ships under
`docs/protocol/fixtures` in the npm package. Its root is an object with
`schemaVersion: 1` (fixture format) and `cases`, an array of objects with:

- `name`: a unique case label.
- `valid`: whether the parsed `document` has the ownership marker shape above.
- `document`: the JSON value to validate; serialize it when testing a text parser.

Cases cover field types, required and unknown fields, path grammar, case
collisions, ordering and Unicode. They test marker shape, not gzip/tar parsing,
raw JSON decoding, archive completeness, authorization or all upload limits.
The packed-consumer smoke checks these installed fixtures with an independent
reader and then verifies actual published inventories against every tar entry.
