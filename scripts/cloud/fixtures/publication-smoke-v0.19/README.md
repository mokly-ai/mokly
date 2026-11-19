# Mokly 0.19 Publication Smoke Fixture

This frozen source catalogue belongs to the live publication smoke for the
newest published `@mokly/mokly@latest` CLI. Its authored heading is `Ready to review`.
It uses one `defineScreen` export with a shared render and JSON configuration.

The smoke copies the source into an independent temporary Git repository.
It links dependencies from one isolated npm installation with its own prefix.
It validates each revision with that installation's executable and
`build --strict --no-changes --config mokly.config.json --out .context/validation`
before committing source. It changes the heading to `Ready to publish` for the
second revision. Neither commit contains generated output or dependency links.

The smoke builds an expected export with `--strict --base HEAD~1` in that same
checkout. It then publishes twice with `--strict --base HEAD~1` and no output
option. Every served export file must match the strict build byte for byte.
This includes the index, details, screen documents and comparison snapshots.
The same checkout keeps React document keys consistent between the two builds.
The stored envelope must use version 3. The index must use version 9 and count
the changed screen. The API must list that screen with its current views.

`publication_smoke_fixture.py` owns the source revisions and process environment.
`publication_smoke_cli.py` owns the real upload, served-file comparison and replay.
Their temporary root holds the CLI's `TMPDIR` and `XDG_CACHE_HOME`. Removing that
root also removes any private build that a failed upload kept.

Keep this fixture independent of the product catalogue and contract fixtures.
Build output exists only in the ignored `.context/` of a disposable checkout.
The fixture also ignores dependency links and export reservations.

Run the real local service proof with installed dependencies and Postgres:

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/mkc_test \
  cargo test -p mkc-catalogue-server --test publish_tests -- --nocapture
```

The real dirty-checkout refusal must match its recording and create no upload
attempt. The comparison accepts only npm notice or warning lines before the
exact recorded stderr. The installed package supplies the publish version, which the smoke records.
[Capture recordings](../../../../infra/tests/fixtures/README.md#catalogue-capture-fixtures)
use this fixture through `infra/scripts/record-catalogue-capture.py`.
