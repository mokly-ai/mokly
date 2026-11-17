//! Equal classifications reuse the slot; key moves end old handles before preparation.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, Weak};

use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::{BaseProviderMock, PreparedBase};
use mokly_compare::base_retention::KeptBase;
use mokly_graph::types::RenderGenerationMock;
use mokly_server::changes::ChangeCancellation;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::{catalogue, config};

use super::flow_support::{Calls, classify, comparison, sources};
use super::support::{Fixture, head, inputs, runtime, selected};

#[test]
fn equal_classifications_prepare_once_and_key_moves_release_before_preparation() {
    let calls = Arc::new(Calls::default());
    let retired: Arc<Mutex<Option<Weak<KeptBase>>>> = Arc::default();
    let old_alive = Arc::new(Mutex::new(Vec::new()));
    let inner = Arc::new(Unimock::new(
        BaseProviderMock::prepare
            .each_call(matching!(_))
            .answers_arc({
                let calls = calls.clone();
                let retired = retired.clone();
                let old_alive = old_alive.clone();
                Arc::new(move |_, _| {
                    calls.prepares.fetch_add(1, Ordering::Relaxed);
                    old_alive.lock().unwrap().push(
                        retired
                            .lock()
                            .unwrap()
                            .as_ref()
                            .and_then(Weak::upgrade)
                            .is_some(),
                    );
                    Ok(PreparedBase {
                        generation: Arc::new(Unimock::new(
                            RenderGenerationMock::catalogue
                                .some_call(matching!())
                                .returns(catalogue(Vec::new())),
                        )),
                        scripts_off: false,
                        freshness: Some(inputs(false)),
                    })
                })
            }),
    ));
    let slot = Arc::default();
    let sources = sources(calls.clone());
    let comparison = comparison(calls.clone());
    let first = Fixture::new(slot, Arc::new(Unimock::new(())), inner.clone(), runtime());
    {
        let result = classify(
            first.provider.clone(),
            selected("a"),
            sources.clone(),
            comparison.clone(),
            head(false),
            &config(),
        )
        .unwrap();
        assert_eq!(result.review.base_commit, "a".repeat(40));
    }
    *retired.lock().unwrap() = Some(Arc::downgrade(
        &first.slot.lock().unwrap().as_ref().unwrap().base,
    ));
    first.origin.cancel();
    let second = Fixture::new(
        first.slot.clone(),
        Arc::new(Unimock::new(
            FreshnessMock::current
                .some_call(matching!(_))
                .returns(Ok(true)),
        )),
        inner.clone(),
        runtime(),
    );
    {
        let result = classify(
            second.provider.clone(),
            selected("a"),
            sources.clone(),
            comparison.clone(),
            head(false),
            &config(),
        )
        .unwrap();
        assert_eq!(result.review.base_commit, "a".repeat(40));
        assert_eq!(calls.counts(), (1, 1, 1));
    }
    second.origin.cancel();
    let third = Fixture::new(
        first.slot.clone(),
        Arc::new(Unimock::new(())),
        inner,
        runtime(),
    );
    let result = classify(
        third.provider.clone(),
        selected("b"),
        sources,
        comparison,
        head(false),
        &config(),
    )
    .unwrap();
    assert_eq!(result.review.base_commit, "b".repeat(40));
    assert_eq!(calls.counts(), (2, 2, 2));
    assert_eq!(*old_alive.lock().unwrap(), [false, false]);
    assert!(
        retired
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .upgrade()
            .is_none()
    );
}
