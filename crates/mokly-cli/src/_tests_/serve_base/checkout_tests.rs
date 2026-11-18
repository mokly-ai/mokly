//! Checkout changes during real preparation invalidate the retained earlier sample.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_compare::base_freshness::{Freshness, FreshnessChecks};
use mokly_compare::base_render::{BaseSourceFactoryMock, HistoricalSources};
use mokly_compare::working_inputs::SystemWorkingInputs;
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::workers::RenderWorkersMock;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::changes_base::NativeBase;
use crate::serve_base::BaseSlot;
use crate::warning_support::config;

use super::flow_support::{Calls, classify, comparison, failures};
use super::support::{Fixture, head, selected};

fn native(slot: Arc<BaseSlot>, freshness: Arc<dyn Freshness>, runtime: Arc<Runtime>) -> Fixture {
    let mut fixture = Fixture::new(
        slot,
        freshness.clone(),
        Arc::new(Unimock::new(())),
        runtime.clone(),
    );
    Arc::get_mut(&mut fixture.provider).unwrap().inner = Arc::new(NativeBase {
        runtime,
        freshness: Some(freshness),
        cancellation: fixture.lifetime.clone(),
        dependencies: Arc::new(Unimock::new(())),
    });
    fixture
}

#[test]
fn checkout_change_after_first_read_keeps_old_sample_then_prepares_and_reuses_new_sample() {
    let calls = Arc::new(Calls::default());
    let setting = Arc::new(Mutex::new("before"));
    let samples = Arc::new(Mutex::new(Vec::new()));
    let mut selected = selected("a");
    selected.repository = Arc::new(Unimock::new(
        RepositoryMock::checkout_identity
            .each_call(matching!(_))
            .answers_arc({
                let setting = setting.clone();
                let samples = samples.clone();
                Arc::new(move |_, _| {
                    let digest = *setting.lock().unwrap();
                    samples.lock().unwrap().push(digest);
                    Ok(CheckoutIdentity {
                        digest: digest.into(),
                        filtered: false,
                    })
                })
            }),
    ));
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc({
                let setting = setting.clone();
                Arc::new(move |_, _| {
                    *setting.lock().unwrap() = "after";
                    Ok(None)
                })
            }),
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    )));
    let sources = Arc::new(Unimock::new(
        BaseSourceFactoryMock::create
            .each_call(matching!(_))
            .answers_arc({
                let calls = calls.clone();
                Arc::new(move |_, _, _, _| {
                    calls.sources.fetch_add(1, Ordering::Relaxed);
                    Ok(HistoricalSources {
                        tree: tree.clone(),
                        failures: failures(),
                        sources: Arc::new(Unimock::new(())),
                    })
                })
            }),
    ));
    let runtime = Arc::new(Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            RenderWorkersMock::stylesheets
                .each_call(matching!(_))
                .answers(&|_, _, _| Ok(Vec::new())),
        )),
        "test".into(),
        None,
    ));
    let freshness: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
        working: Arc::new(SystemWorkingInputs),
        installs: Arc::new(Unimock::new(())),
    });
    let comparison = comparison(calls.clone());
    let first = native(Arc::default(), freshness.clone(), runtime.clone());
    {
        let result = classify(
            first.provider.clone(),
            selected.clone(),
            sources.clone(),
            comparison.clone(),
            head(true),
            &config(),
        )
        .unwrap();
        assert_eq!(result.review.base_commit, "a".repeat(40));
    }
    let retired = {
        let slot = first.slot.lock().unwrap();
        let kept = &slot.as_ref().unwrap().base;
        assert_eq!(kept.freshness.as_ref().unwrap().checkout.digest, "before");
        Arc::downgrade(kept)
    };
    let second = native(first.slot.clone(), freshness.clone(), runtime.clone());
    {
        let result = classify(
            second.provider.clone(),
            selected.clone(),
            sources.clone(),
            comparison.clone(),
            head(true),
            &config(),
        )
        .unwrap();
        assert_eq!(result.review.base_commit, "a".repeat(40));
    }
    assert!(retired.upgrade().is_none());
    assert_eq!(calls.counts(), (2, 0, 2));
    assert_eq!(
        second
            .slot
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .base
            .freshness
            .as_ref()
            .unwrap()
            .checkout
            .digest,
        "after"
    );
    let third = native(first.slot.clone(), freshness, runtime);
    let result = classify(
        third.provider.clone(),
        selected,
        sources,
        comparison,
        head(true),
        &config(),
    )
    .unwrap();
    assert_eq!(result.review.base_commit, "a".repeat(40));
    assert_eq!(calls.counts(), (2, 0, 2));
    assert_eq!(
        *samples.lock().unwrap(),
        ["before", "after", "after", "after"]
    );
}
