//! Each fixture declares only boundaries its scenario can reach.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_graph::types::RenderGenerationMock;
use mokly_static::assembly::AssemblerMock;
use mokly_static::error::Error;
use mokly_static::fingerprint::InputTreeMock;
use mokly_static::transaction::TransactionMock;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildChanges, BuildError, BuildServiceMock, BuildSummary, PreparedBuild};
use crate::cancellation::{Cancellation, CancellationMock};
use crate::static_build::{Builder, DrainMock, PhasesMock, TimestampMock};

use super::support::{Case, artifact, catalogue, config, record, step, warning};

pub(super) fn mocks(case: Case, events: Arc<Mutex<Vec<&'static str>>>) -> (Builder, Unimock) {
    mocks_with_cancellation(case, events, None)
}

pub(super) fn mocks_with_cancellation(
    case: Case,
    events: Arc<Mutex<Vec<&'static str>>>,
    supplied: Option<Arc<dyn Cancellation>>,
) -> (Builder, Unimock) {
    let renders = case.fail != "fingerprint";
    let protects = !matches!(case.fail, "fingerprint" | "render");
    let warned = protects && case.fail != "protect";
    let assembles = warned && !case.warnings;
    let stages = assembles && case.fail != "assemble";
    let verifies = stages && case.fail != "stage";
    let finished = verifies && case.fail != "verify";
    let installs = finished
        && !case.cancelled
        && !case.stop_fails
        && !case.final_fingerprint_fails
        && !case.input_changes;
    let graph = Arc::new(if !protects {
        Unimock::new(())
    } else {
        Unimock::new(
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue()),
        )
    });
    let render = if !renders {
        Unimock::new(())
    } else {
        let events = events.clone();
        Unimock::new(
            BuildServiceMock::prepare
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    record(&events, "render");
                    if case.fail == "render" {
                        return Err(BuildError::Viewer);
                    }
                    Ok(PreparedBuild {
                        config: config(),
                        generation: graph.clone(),
                        summary: BuildSummary {
                            changes: if case.ready {
                                super::ready_tests::changes()
                            } else {
                                BuildChanges::Disabled
                            },
                            documents: 1,
                            counts: BTreeMap::new(),
                            warnings: if case.warnings {
                                vec![warning()]
                            } else {
                                vec![]
                            },
                            deferred_modules: vec![],
                        },
                    })
                })),
        )
    };
    let assembler = if !assembles {
        Unimock::new(())
    } else {
        let events = events.clone();
        Unimock::new(
            AssemblerMock::assemble
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, input, _| {
                    record(&events, "assemble");
                    step(case, "assemble")?;
                    assert_eq!(input.changes.ready().is_some(), case.ready);
                    if let Some(metadata) = input.publication {
                        assert_eq!(metadata.exported_at, "2026-10-15T12:00:00.000Z");
                    }
                    Ok(artifact())
                })),
        )
    };
    let capture_events = events.clone();
    let begin = InputTreeMock::begin
        .some_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, _, _| {
            record(&capture_events, "fingerprint");
            step(case, "fingerprint")
        }));
    let inputs = if !verifies {
        Unimock::new(begin)
    } else {
        let events = events.clone();
        Unimock::new((
            begin,
            InputTreeMock::verify
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    record(&events, "verify");
                    step(case, "verify")?;
                    if case.final_fingerprint_fails {
                        return Err(Error::Unexpected {
                            path: "/changed".into(),
                        });
                    }
                    if case.input_changes {
                        return Err(Error::InputsChanged {
                            path: "/repo/specs/home.screen.html".into(),
                        });
                    }
                    Ok(())
                })),
        ))
    };
    let drain = {
        let events = events.clone();
        Unimock::new(
            DrainMock::stop
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    record(&events, "stop");
                    if case.stop_fails {
                        Err(BuildError::Viewer)
                    } else {
                        Ok(())
                    }
                })),
        )
    };
    let phases = if !renders {
        Unimock::new(())
    } else if !warned {
        Unimock::new(PhasesMock::start.each_call(matching!(_)).returns(()))
    } else if case.ready {
        let warnings = events.clone();
        let changes = events.clone();
        Unimock::new((
            PhasesMock::start.each_call(matching!(_)).returns(()),
            PhasesMock::warnings
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| record(&warnings, "warnings"))),
            PhasesMock::changes
                .next_call(matching!((changes) if matches!(changes, BuildChanges::Ready(_))))
                .answers_arc(Arc::new(move |_, _| record(&changes, "changes"))),
        ))
    } else {
        Unimock::new((
            PhasesMock::start.each_call(matching!(_)).returns(()),
            PhasesMock::warnings.some_call(matching!(_)).returns(()),
        ))
    };
    let cancellation = supplied.unwrap_or_else(|| {
        let drained = events.clone();
        let queried = events.clone();
        Arc::new(Unimock::new((
            CancellationMock::drain
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    record(&drained, "signals");
                })),
            CancellationMock::requested
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    record(&queried, "cancelled");
                    case.cancelled
                })),
        )))
    });
    let timestamp = if !case.publication || !assembles {
        Unimock::new(())
    } else {
        let events = events.clone();
        Unimock::new(
            TimestampMock::now
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    record(&events, "timestamp");
                    "2026-10-15T12:00:00.000Z".into()
                })),
        )
    };
    let builder = Builder {
        render: Arc::new(render),
        assembler: Arc::new(assembler),
        inputs: Arc::new(inputs),
        cancellation,
        drain: Arc::new(drain),
        timestamp: Arc::new(timestamp),
        phases: Arc::new(phases),
    };
    let common = (
        TransactionMock::output
            .each_call(matching!())
            .answers(&|_| Path::new("/repo/site")),
        TransactionMock::recovery_path
            .each_call(matching!())
            .answers(&|_| Path::new("/repo/.mokly-export-reservations/locks/site")),
    );
    let protection = events.clone();
    let staged = events.clone();
    let installed = events.clone();
    let abandoned = events;
    let protect = TransactionMock::protect
        .some_call(matching!(_))
        .answers_arc(Arc::new(move |_, paths| {
            record(&protection, "protect");
            assert_eq!(
                paths,
                vec![Path::new("/repo/specs/home.screen.html").to_owned()]
            );
            step(case, "protect")
        }));
    let stage = TransactionMock::stage
        .some_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, _, _| {
            record(&staged, "stage");
            step(case, "stage")
        }));
    let install = TransactionMock::install
        .some_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| {
            record(&installed, "install");
            step(case, "install")
        }));
    let abandon = TransactionMock::abandon
        .some_call(matching!())
        .answers_arc(Arc::new(move |_| {
            record(&abandoned, "abandon");
            if case.abandon_fails {
                Err(Error::Unexpected {
                    path: "/retained".into(),
                })
            } else {
                Ok(())
            }
        }));
    let transaction = if installs {
        Unimock::new((common, protect, stage, install))
    } else if stages {
        Unimock::new((common, protect, stage, abandon))
    } else if protects {
        Unimock::new((common, protect, abandon))
    } else {
        Unimock::new((common, abandon))
    };
    (builder, transaction)
}
