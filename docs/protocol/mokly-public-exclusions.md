# Public Exclusion Configuration

`publicExclude?: readonly string[]` extends the defaults in the
[source-protection contract](./mokly-source-protection.md#public-exclusions):
`**/README`, `**/README.*`, `**/tsconfig.json`, and `**/tsconfig.*.json`.
The case-folded defaults are prepended without mutating consumer input;
omission and an empty array produce the defaults alone.
The resolved list is frozen. Watched children require this already-resolved
array and use the shared glob validator to adopt a frozen copy with exactly
the transferred entries, without prepending defaults again. Missing, non-array
or unsafe values reject the startup message. Repeated globs are harmless and
do not fail config.

Validate the array and each string at config load. A safe relative POSIX glob
is nonempty and contains no absolute/drive/UNC prefix, backslash,
colon, NUL/control character, or empty, `.` or `..` path segment. Reject
whitespace-only strings, leading `!` negation, and leading `#` comment syntax.
Use the repository's minimatch glob syntax; any brace-expanded alternative must
also satisfy those path rules. Invalid input fails with the typed `config-invalid`
error naming `publicExclude` and the offending item, before publication or serving.

Match the whole candidate path relative to `mockupsDir`, not relative to
`repoRoot` or the config directory, with case-insensitive and dotfile matching.
For example, `publicExclude: ["internal/**"]` hides that directory's contents
under `mockupsDir` in addition to every shipped default. Realpath aliases and
all public-resource boundaries use the same source-protection policy.
