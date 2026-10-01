# Public Exclusion Configuration

## Status And Scope

Implemented as part of Mokly's configuration and source-protection boundary.
This contract owns `publicExclude` defaults, validation, path matching, and
watched-child transfer.

## Configuration

`publicExclude?: readonly string[]` extends the defaults from the
[source-protection contract](./mokly-source-protection.md#public-exclusions):
`**/README`, `**/README.*`, `**/tsconfig.json`, and `**/tsconfig.*.json`.
Case-folded defaults are prepended without mutating consumer input; omission
and an empty array produce only the defaults.

The resolved list is frozen. Watched children require this already-resolved
array and use the shared glob validator to adopt a frozen copy with exactly the
transferred entries, without prepending defaults again. Missing, non-array, or
unsafe values reject the startup message. Repeated globs are harmless.

## Validation And Matching

Validate the array and every string at config load. A safe relative POSIX glob
is nonempty and contains no absolute, drive, or UNC prefix, backslash, colon,
NUL/control character, or empty, `.` or `..` path segment. Reject
whitespace-only strings, leading `!` negation, and leading `#` comment syntax.
Use the repository's minimatch syntax; every brace-expanded alternative must
also satisfy those rules. Invalid input fails with typed `config-invalid`,
naming `publicExclude` and the offending item before publication or serving.

Match the complete candidate path relative to `mockupsDir`, not `repoRoot` or
the config directory, with case-insensitive and dotfile matching. For example,
`publicExclude: ["internal/**"]` hides that directory under `mockupsDir` in
addition to every shipped default. Realpath aliases and all public-resource
boundaries use the same source-protection policy.

## Related Docs

- [Configuration contract](./mokly-configuration.md)
- [Source protection](./mokly-source-protection.md)
- [Watched development](./mokly-watch.md)
