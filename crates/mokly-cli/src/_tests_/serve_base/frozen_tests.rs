//! A real frozen-resource mismatch drops the old base and prepares once in that attempt.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, Weak};

use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::{BaseProviderMock, PreparedBase};
use mokly_compare::base_retention::KeptBase;
use mokly_compare::comparison_types::ComparisonMock;
use mokly_compare::error::Error;
use mokly_graph::types::RenderGenerationMock;
use mokly_server::changes::ChangeCancellation;
use mokly_server::comparison_graph::FrozenResources;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::{catalogue, config};

use super::flow_support::{Calls, classify, result, sources};
use super::support::{Fixture, head, inputs, runtime, selected};

#[test]
fn reused_frozen_resource_change_releases_and_prepares_once_without_old_local_handles() {
    let calls = Arc::new(Calls::default());
    let bytes = Arc::new(Mutex::new(b"before".to_vec()));
    let retired: Arc<Mutex<Option<Weak<KeptBase>>>> = Arc::default();
    let alive = Arc::new(Mutex::new(Vec::new()));
    let inner = Arc::new(Unimock::new(
        BaseProviderMock::prepare
            .each_call(matching!(_))
            .answers_arc({
                let calls = calls.clone();
                let bytes = bytes.clone();
                let retired = retired.clone();
                let alive = alive.clone();
                Arc::new(move |_, _| {
                    calls.prepares.fetch_add(1, Ordering::Relaxed);
                    alive.lock().unwrap().push(
                        retired
                            .lock()
                            .unwrap()
                            .as_ref()
                            .and_then(Weak::upgrade)
                            .is_some(),
                    );
                    let bytes = bytes.clone();
                    Ok(PreparedBase {
                        prefetch: None,
                        generation: Arc::new(FrozenResources::new(Arc::new(Unimock::new((
                            RenderGenerationMock::catalogue
                                .some_call(matching!())
                                .returns(catalogue(Vec::new())),
                            RenderGenerationMock::check_cancelled
                                .each_call(matching!())
                                .answers(&|_| Ok(())),
                            RenderGenerationMock::resource_bytes
                                .each_call(matching!("static/image.png"))
                                .answers_arc(Arc::new(move |_, _| {
                                    Ok(Some(bytes.lock().unwrap().clone()))
                                })),
                        ))))),
                        scripts_off: false,
                        freshness: Some(inputs(false)),
                    })
                })
            }),
    ));
    let comparison = Arc::new(Unimock::new((
        ComparisonMock::capture_base
            .each_call(matching!(_))
            .answers_arc({
                let calls = calls.clone();
                Arc::new(move |_, base| {
                    calls.captures.fetch_add(1, Ordering::Relaxed);
                    base.resource_bytes("static/image.png")
                        .map_err(|source| Error::Graph { source })?;
                    Ok(base)
                })
            }),
        ComparisonMock::compare_prepared
            .each_call(matching!(_))
            .answers(&|_, request, before, after| {
                before
                    .resource_bytes("static/image.png")
                    .map_err(|source| Error::Graph { source })?;
                Ok(result(request, before, after))
            }),
    )));
    let sources = sources(calls.clone());
    let first = Fixture::new(
        Arc::default(),
        Arc::new(Unimock::new(())),
        inner.clone(),
        runtime(),
    );
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
        assert_eq!(
            result.before.resource_bytes("static/image.png").unwrap(),
            Some(b"before".to_vec())
        );
    }
    *retired.lock().unwrap() = Some(Arc::downgrade(
        &first.slot.lock().unwrap().as_ref().unwrap().base,
    ));
    *bytes.lock().unwrap() = b"after".to_vec();
    first.origin.cancel();
    let second = Fixture::new(
        first.slot.clone(),
        Arc::new(Unimock::new(
            FreshnessMock::current
                .some_call(matching!(_))
                .returns(Ok(true)),
        )),
        inner,
        runtime(),
    );
    let result = classify(
        second.provider.clone(),
        selected("a"),
        sources,
        comparison,
        head(false),
        &config(),
    )
    .unwrap();
    assert_eq!(
        result.before.resource_bytes("static/image.png").unwrap(),
        Some(b"after".to_vec())
    );
    assert_eq!(calls.counts(), (2, 2, 2));
    assert_eq!(*alive.lock().unwrap(), [false, false]);
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
