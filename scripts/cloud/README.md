# Development And Publication Scripts

These scripts run local services and test the API with real processes,
Postgres and local file storage. They use the workspace Mokly package, and the
published-CLI smoke installs `@mokly/mokly@latest` in its own npm prefix.
The publication boundary uses envelope 3, ownership marker 3 and index 9.

Run the publication integration and its Python tests from the repository root:

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/mkc_test \
  cargo test -p mkc-catalogue-server --test publish_tests
python3 -m unittest discover -s scripts/cloud/_tests_ -p '*_tests.py' -v
```

The Rust API tests also run `smoke_preview_plan.py`, `smoke_api.py` and
`smoke_viewer_reads.py`. Project inputs use repository-relative JSON config
paths. The desktop origin scripts check origin admission without a catalogue
format dependency.

### Key Code

- `smoke_publications.py` runs the publication scenarios against real services.
- `publication_exchange.py` builds three-file Plans and runs Blob and Complete.
  It also converts test uploads to current-only indexes and envelopes.
- `publication_smoke_support.py` reads the committed fixture's producer version
  from `checksums.json`. Fixture consumers use that metadata, not a release pin.
- `publication_smoke_fixture.py` strictly validates two source-only revisions
  of the [frozen fixture](./fixtures/publication-smoke-v0.19/README.md).
- `publication_smoke_consumer.py` installs npm `latest` with the dependencies
  that npm held when that release published, rejects linked or escaped
  package paths, and records the installed version.
- `publication_smoke_cli.py` publishes with that installation's executable,
  compares every served file with a strict build of the same checkout and
  base, checks replay, and compares the real dirty refusal with its recording.
- `build_upload_fixture.py` adapts the released contract export for build
  integration tests. The required index stays in every current-only Plan.
- `smoke_viewer_reads.py` checks the viewer API, retained observations and Share.
  `viewer_index_smoke.py` adds moved paths, four view axes, original case
  evidence and the index path limit.
- `dev-api.sh` and `dev-catalogue.sh` start local services with shared storage.

### Related Docs

- [Publication smoke](../../docs/ops/publish-smoke.md)
- [Viewer read model](../../docs/protocol/cloud/viewer-read-model.md)
- [Capture recordings](../../infra/tests/fixtures/README.md#catalogue-capture-fixtures)
- [Infrastructure](../../infra/README.md)
