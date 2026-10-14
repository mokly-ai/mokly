# Rebuild Reference Tables

`behaviour-table.mjs` reduces one captured scenario to a sorted JSON table.
Run it from the repository root:

```bash
node scripts/rebuild/behaviour-table.mjs /absolute/scenario
node scripts/rebuild/behaviour-table.mjs /absolute/scenario /absolute/table.json
```

The default output is `behaviour-table.json` inside the scenario directory.
The table has its own schema version. It contains entry kinds and paths,
listed changes with states and reasons, affected consumers, kept and excluded
CSS rule evidence per view, and resource closures per view and side. It excludes
commits, timestamps, deployment ids, artifact generation names, and file hashes.
Each array represents a set. Arrays and object keys use code-unit order.

The input adapter reads these capture files:

- `catalogue.json`: catalogue read model v6.
- `review.json`: review result v7.
- `export-inventory.json`: export ownership v3.
- `resource-closures.json`: resource paths per entry, viewport, and colour
  scheme. Capture computes these paths from exported document and CSS
  references before it discards the generated tree. It excludes viewer runtime
  scripts. The export inventory defines the files available to that traversal.

A partial capture can omit files. The table's `availability` fields state
which inputs exist. Missing data produces empty sets. Invalid JSON and
unsupported versions fail with an error. The format has no dependency on the
catalogue, detail, or review formats used by the Rust implementation. A new
adapter supplies the same table fields.

Use the pure `behaviourTable` function with parsed inputs in unit tests.
Use `readScenario` to load a capture directory. The integration test checks
that the CLI writes the same table.
