//! Static provider admission keeps verification between preparation and rendering.

use std::sync::{Arc, Mutex};

use mokly_compare::error::Error;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_static::error;
use mokly_static::fingerprint::InputTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::base_render_admission::BaseRenderAdmission;
use crate::changes_static::StaticBase;

#[test]
fn static_base_admits_only_a_verified_prepared_generation() {
    for changed in [false, true] {
        let generation: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
        let boundaries = Unimock::new(InputTreeMock::verify.next_call(matching!()).returns(
            if changed {
                Err(error::Error::InputsChanged {
                    path: "/selected/plugin.mjs".into(),
                })
            } else {
                Ok(())
            },
        ));
        let admission: &dyn BaseRenderAdmission = &StaticBase {
            inputs: Arc::new(boundaries),
        };
        let result = admission.admit(generation.clone(), true);
        if changed {
            assert!(matches!(
                result,
                Err(error)
                    if error.scripts_off
                        && matches!(&*error.source, Error::Graph {
                            source: GraphError::InputsChanged { path },
                        } if path.to_str() == Some("/selected/plugin.mjs"))
            ));
        } else {
            let prepared = result.unwrap();
            assert!(Arc::ptr_eq(&prepared.generation, &generation));
            assert!(prepared.scripts_off);
        }
    }
}

#[test]
fn static_base_keeps_scripts_off_after_another_input_verification_failure() {
    let boundaries = Unimock::new(
        InputTreeMock::verify
            .next_call(matching!())
            .returns(Err(error::Error::Cancelled)),
    );
    let admission: &dyn BaseRenderAdmission = &StaticBase {
        inputs: Arc::new(boundaries),
    };
    let result = admission.admit(Arc::new(Unimock::new(())), true);
    assert!(matches!(result, Err(error)
        if error.scripts_off && matches!(error.source.as_ref(), Error::Graph {
            source: GraphError::Internal(InternalError::Provider { source }),
        } if matches!(source.downcast_ref::<error::Error>(), Some(error::Error::Cancelled)))
    ));
}

#[test]
fn static_base_checks_witnesses_before_starting_early_document_work() {
    for changed in [false, true] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let observed = events.clone();
        let checks = Unimock::new(InputTreeMock::verify.next_call(matching!()).answers_arc(
            Arc::new(move |_| {
                observed.lock().unwrap().push("verify");
                if changed {
                    Err(error::Error::InputsChanged {
                        path: "/selected/value.mjs".into(),
                    })
                } else {
                    Ok(())
                }
            }),
        ));
        let observed = events.clone();
        let generation = Unimock::new(
            RenderGenerationMock::prefetch_comparison
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    observed.lock().unwrap().push("prefetch");
                    Ok(None)
                })),
        )
        .no_verify_in_drop();
        let admission: &dyn BaseRenderAdmission = &StaticBase {
            inputs: Arc::new(checks),
        };
        let result = admission.admit(Arc::new(generation), true);
        let expected = if changed {
            vec!["verify"]
        } else {
            vec!["verify", "prefetch"]
        };
        assert_eq!(
            *events.lock().unwrap(),
            expected,
            "static witnesses must pass before any early document callback starts"
        );
        let actual = match result {
            Ok(prepared) => (prepared.scripts_off, None),
            Err(error) => match *error.source {
                Error::Graph {
                    source: GraphError::InputsChanged { path },
                } => (error.scripts_off, Some(path)),
                other => panic!("unexpected admission failure: {other}"),
            },
        };
        let expected = (true, changed.then(|| "/selected/value.mjs".into()));
        assert_eq!(actual, expected);
    }
}
