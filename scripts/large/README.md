# Large-fixture measurements

These local tools prepare deterministic consumer catalogues and measure real
Serve classification. Build Mokly first. The [fixture README](../../tests/fixtures/large/README.md)
owns setup and historical results; the
[benchmark contract](../../tests/fixtures/large/benchmark-contract.md) owns identity,
scenarios, restoration and acceptance.

```bash
npm run fixture:large
npm run benchmark:large -- --scenario no-changes --scenario linked-stylesheet
node scripts/large/cli.mjs details --scenario linked-stylesheet
```

`benchmark` records cold/warm samples using exactly the M8 core diagnostics.
It explicitly sets `MOKLY_MATERIAL_WORK=0` for Serve and inherited workers,
even if the caller enables it. A detail event or material/companion field in a
timed sample is a measurement error, and forbidden fields are omitted.

`details` is a separate untimed companion command, never part of the timed matrix.
It accepts the same fixture/size/output options and repeated `--scenario` filter.
Each selected scenario restores and edits the same prepared baseline inputs,
starts one fresh server with `MOKLY_MATERIAL_WORK=1`, checks complete membership,
and emits `Material companion` JSON. It records the fixture/template/engine
identity, expected and observed membership, shared work counts, and exact
`review.material-work` counts, labelled `kind: material-work-companion`,
`timed: false`. It reports no startup/classification/delivery duration or
cold/warm label. Do not copy these counts into timed sample records.
Both commands stop owned processes and restore setup after errors/interruption.
Run detail passes after timed runs, while other heavy work is idle.

`sample.mjs` shares Serve/browser capture but selects separate outcome builders.
`outcomes.mjs` enforces timing isolation; `companion_outcome.mjs` requires one
scoped detail record with valid exact counts and bounds. `materialDetails` owns
one pass per scenario; `benchmark` retains the existing cold/warm matrix.

Never edit files under `tests/fixtures/large/` except `README.md` for diagnostics
work. `identity.mjs` hashes all other template bytes, so edits invalidate shared
fixtures. The mainline path-identity migration changes those templates; a later
acceptance plan needs a fresh same-session reference. Harness code lives here,
outside that digest.

```bash
node --import tsx --test tests/large_material*.test.ts tests/large_companion_outcomes.test.ts
```

The [timing protocol](../../docs/protocol/mokly-timings.md) defines the opt-in;
[material work](../../docs/protocol/mokly-material-work-counts.md) defines counts.
