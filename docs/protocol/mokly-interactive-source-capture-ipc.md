# Interactive Views: Accepted Source Capture IPC

This transient wire contract belongs to
[generation-pinned Live sources](./mokly-interactive-source-pinning.md).
It carries accepted bytes and request metadata only between watched Serve
processes. It is absent from public and published output.

`ComponentRuntime.interactiveSources` carries the decoded capture. Runtime IPC
uses this exact projection:

```ts
interface InteractiveSourceCaptureMessage {
  files: readonly {
    bytes: string; // canonical padded RFC 4648 base64
    paths: readonly string[];
  }[];
  resolutions: readonly {
    attributes: readonly { key: string; value: string }[];
    importer:
      | { type: "entry" }
      | { type: "repository"; path: string }
      | { type: "installed"; path: string };
    kind:
      | "entry-point"
      | "import-statement"
      | "require-call"
      | "dynamic-import"
      | "require-resolve"
      | "import-rule"
      | "composes-from"
      | "url-token";
    specifier: string;
    target: string;
  }[];
}
```

Every path is safe repository-relative POSIX. Paths within a blob and blobs by
their first path are strictly sorted and nonempty; no path occurs twice. The
resolution list is strictly sorted by complete request key with no duplicate.
It has at most 16,384 records and 8 MiB of UTF-8 string data. A nonempty
specifier is at most 2,048 UTF-8 bytes. Each record has at most 16 uniquely
named, sorted attributes; each nonempty key is at most 256 bytes, each value at
most 2,048, and one record's keys and values total at most 4,096. Strings
contain no NUL. Repository and installed importer paths have the same safety
rules and count toward the same aggregate byte bound. Each target is a safe
captured path. Installed records require a `.css` target or a repository-source
blob. A repository-source blob has at least one alias without a `node_modules`
segment, its confined physical repository identity. All aliases of that blob
can be targets, including a logical linked-package path under `node_modules`.
A blob whose non-CSS aliases all lie under `node_modules` is not an installed
record target. Only the listed kinds and exact importer shapes are valid.

The child validates shape, canonical base64, ordering, limits, and referential
integrity before exposing the runtime. The field is required when interactive
Serve is enabled and absent when off. Build, Check, export, publication, and an
off Serve neither install the capture hook nor retain or transfer source data.

Retention and generation reuse follow the
[source-pinning contract](./mokly-interactive-source-pinning.md#retention-and-memory-bounds).
