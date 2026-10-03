# Dependency audit fixtures

These fixtures come from `npm ci` and a live audit on 2026-10-03 UTC.
The original report has 13 high entries and one advisory object.
It includes the Metro and Metro Config cycle.

```bash
npm ci
npm audit --json --audit-level=low --include=prod --include=dev --include=optional --include=peer
```

`report.json` keeps the report version, package names, severities, advisory
names, dependency names, titles, URLs, install locations, and effect references.
It omits remediation suggestions, ranges, and metadata that the evaluator does
not use.

`lockfile.json` keeps the root, the viewer workspace, the three exception path
entries, and Metro's incoming dependency. It keeps the actual versions and
development and peer flags. Dependency maps retain only references to the three
path packages. Tests add other references and install locations to check the
scope rules. These are test fixtures. Product checks read the full live report
and the full workspace lockfile.
