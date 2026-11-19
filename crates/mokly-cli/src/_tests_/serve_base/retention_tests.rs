//! Only eligible, current captures detach from their preparing classification.

use std::sync::{Arc, Barrier};
use std::thread;

use mokly_cli::cancellation::Cancellation;
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::{BaseRetentionRequest, KeptBase};
use mokly_compare::error::Error;
use mokly_compare::source_failures::SourceFailuresMock;
use mokly_graph::types::RenderGenerationMock;
use mokly_server::changes::ChangeCancellation;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::{catalogue, config, warning};

use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn ineligible_captures_stay_attached_and_replaced_classifications_cannot_keep() {
    for reason in [
        "absent",
        "filtered",
        "failure",
        "source-warning",
        "catalogue-warning",
        "replaced",
    ] {
        let fixture = Fixture::new(
            Arc::default(),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            runtime(),
        );
        let config = config();
        let selected = selected("a");
        let head = head(false);
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: &config,
            head: head.as_ref(),
            install_scripts: false,
        };
        let base = match reason {
            "absent" => base(None),
            "filtered" => {
                let mut evidence = inputs(false);
                evidence.checkout.filtered = true;
                base(Some(evidence))
            }
            "failure" => Arc::new(KeptBase {
                generation: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(
                    SourceFailuresMock::failure
                        .some_call(matching!())
                        .returns(Some(Arc::new(Error::UnsupportedManager))),
                )),
                scripts_off: false,
                freshness: Some(inputs(false)),
            }),
            "source-warning" | "catalogue-warning" => {
                let mut warning = warning("Converted historical bytes.");
                warning.code = "base-conversion";
                let warnings = if reason == "source-warning" {
                    Vec::new()
                } else {
                    vec![warning.clone()]
                };
                let failures = if reason == "source-warning" {
                    Unimock::new((
                        SourceFailuresMock::failure
                            .some_call(matching!())
                            .returns(None),
                        SourceFailuresMock::warnings
                            .some_call(matching!())
                            .returns(vec![warning]),
                    ))
                } else {
                    Unimock::new(
                        SourceFailuresMock::failure
                            .some_call(matching!())
                            .returns(None),
                    )
                };
                Arc::new(KeptBase {
                    generation: Arc::new(Unimock::new(
                        RenderGenerationMock::catalogue
                            .some_call(matching!())
                            .returns(catalogue(warnings)),
                    )),
                    failures: Arc::new(failures),
                    scripts_off: false,
                    freshness: Some(inputs(false)),
                })
            }
            _ => {
                fixture.origin.cancel();
                base(Some(inputs(false)))
            }
        };
        let retained = fixture.provider.keep(&request, base);
        assert!(
            matches!(
                (reason, retained),
                ("replaced", Err(Error::Cancelled)) | (_, Ok(None))
            ),
            "{reason}"
        );
        assert!(fixture.slot.lock().unwrap().is_none(), "{reason}");
        fixture.origin.cancel();
        assert!(fixture.lifetime.requested(), "{reason}");
    }
}

#[test]
fn replacement_during_keep_validation_rejects_the_base_without_detaching() {
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let fixture = Fixture::new(
        Arc::default(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let base = Arc::new(KeptBase {
        generation: Arc::new(Unimock::new(
            RenderGenerationMock::catalogue
                .some_call(matching!())
                .returns(catalogue(Vec::new())),
        )),
        failures: Arc::new(Unimock::new(
            SourceFailuresMock::failure
                .some_call(matching!())
                .answers_arc({
                    let entered = entered.clone();
                    let resume = resume.clone();
                    Arc::new(move |_| {
                        entered.wait();
                        resume.wait();
                        None
                    })
                }),
        )),
        scripts_off: false,
        freshness: Some(inputs(false)),
    });
    let config = config();
    let selected = selected("a");
    let head = head(false);
    let request = BaseRetentionRequest {
        selected: &selected,
        working_config: &config,
        head: head.as_ref(),
        install_scripts: false,
    };
    thread::scope(|scope| {
        let keeping = scope.spawn(|| fixture.provider.keep(&request, base.clone()));
        entered.wait();
        fixture.origin.cancel();
        resume.wait();
        assert!(matches!(keeping.join().unwrap(), Err(Error::Cancelled)));
    });
    assert!(fixture.slot.lock().unwrap().is_none());
    assert!(fixture.lifetime.requested());
}
