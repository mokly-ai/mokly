//! Fresh-base retries share one view attempt without admitting abandoned staging.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_git::control::CancellationMock;
use mokly_git::identity::ObjectId;
use mokly_graph::error::GraphError;
use mokly_model::material::catalogue_key;
use unimock::{MockFn, Unimock, matching};

use crate::base_render::{
    BaseProviderMock, BaseSourceFactoryMock, Changes, ChangesService, HistoricalSources,
    PreparedBase,
};
use crate::base_retention::{BaseRelease, BaseReleaseMock, BaseReuse, KeptBase};
use crate::base_selection::PinnedBase;
use crate::comparison_error::CompareResult;
use crate::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};
use crate::comparison_steps::StepsMock;
use crate::comparison_types::{Comparison, ComparisonMock};
use crate::error::Error;
use crate::source_failures::SourceFailuresMock;

use super::support::{Fixture, engine, request};

#[test]
fn failed_kept_base_retry_clears_its_candidate_before_the_fresh_comparison_fails() {
    let store = MemoryComparisons::new(1024 * 1024);
    let original = Fixture::default();
    let mut request = request();
    request.catalogue_identity = catalogue_key("mokly.config.json");
    let before = original.generation(false, true);
    let after = original.generation(true, true);
    let accepted = store.begin(engine(), ReuseFence::new(&"settings"));
    accepted
        .compare_prepared(&request, before.clone(), after.clone())
        .unwrap();
    accepted.accept();
    let attempt = store.begin(engine(), ReuseFence::new(&"settings"));
    let failures = Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .returns(None),
    ));
    let cancellation = Arc::new(Unimock::new(
        CancellationMock::cancelled
            .each_call(matching!())
            .returns(false),
    ));
    let releases = Arc::new(AtomicUsize::new(0));
    let releaser: Arc<dyn BaseRelease> = Arc::new(Unimock::new(
        BaseReleaseMock::release
            .each_call(matching!(_))
            .answers_arc({
                let releases = releases.clone();
                Arc::new(move |_, _| {
                    releases.fetch_add(1, Ordering::AcqRel);
                })
            }),
    ));
    let kept = Arc::new(KeptBase {
        generation: Fixture {
            failed_resources: true,
            ..original.clone()
        }
        .generation(false, true),
        failures: failures.clone(),
        scripts_off: false,
        freshness: None,
    });
    let fresh = Fixture {
        known: false,
        failed_document: Some("two/index.html".into()),
        ..original.clone()
    }
    .generation(false, true);
    let calls = Arc::new(AtomicUsize::new(0));
    let comparison: Arc<dyn Comparison> = Arc::new(Unimock::new((
        ComparisonMock::capture_base
            .some_call(matching!(_))
            .answers(&|_, base| Ok(base)),
        ComparisonMock::compare_prepared
            .each_call(matching!(_, _, _))
            .answers_arc({
                let attempt = attempt.clone();
                let calls = calls.clone();
                Arc::new(move |_, request, before, after| {
                    let first = calls.fetch_add(1, Ordering::AcqRel) == 0;
                    let result = attempt.compare_prepared(request, before.clone(), after)?;
                    if first {
                        before.resource_digest("static/late.png").compare()?;
                    }
                    Ok(result)
                })
            }),
    )));
    let changes = Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: Some(Arc::new(PinnedBase {
            reference: request.base_ref.clone(),
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&request.base_commit).unwrap(),
        })),
        sources: Arc::new(Unimock::new(
            BaseSourceFactoryMock::create
                .some_call(matching!(_, _, _))
                .answers_arc({
                    let failures = failures.clone();
                    Arc::new(move |_, _, _, _| {
                        Ok(HistoricalSources {
                            failures: failures.clone(),
                            tree: Arc::new(Unimock::new(())),
                            sources: Arc::new(Unimock::new(())),
                        })
                    })
                }),
        )),
        provider: Arc::new(Unimock::new((
            BaseProviderMock::find_kept
                .some_call(matching!(_))
                .answers_arc({
                    let cancellation = cancellation.clone();
                    let releaser = releaser.clone();
                    Arc::new(move |_, _| {
                        Ok(Some(BaseReuse {
                            base: kept.clone(),
                            cancellation: cancellation.clone(),
                            releaser: releaser.clone(),
                        }))
                    })
                }),
            BaseProviderMock::prepare
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(PreparedBase {
                        prefetch: None,
                        generation: fresh.clone(),
                        scripts_off: false,
                        freshness: None,
                    })
                })),
            BaseProviderMock::keep
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, base| {
                    Ok(Some(BaseReuse {
                        base,
                        cancellation: cancellation.clone(),
                        releaser: releaser.clone(),
                    }))
                })),
        ))),
        comparison,
        steps: Arc::new(Unimock::new(
            StepsMock::step.each_call(matching!(_)).returns(()),
        )),
    };
    let mut edited = original.clone();
    edited
        .html
        .insert("one".into(), "<p>abandoned edit</p>".into());
    let error = changes
        .classify(
            &ResolvedConfig {
                input: Config::default(),
                repo_root: "/repo".into(),
                file: "/repo/mokly.config.json".into(),
                roots: vec![],
                modules: Default::default(),
                authored_inputs: vec![],
            },
            None,
            edited.generation(true, true),
            None,
        )
        .unwrap_err();
    assert!(
        matches!(error, Error::Graph { source: GraphError::InputsChanged { path } } if path.to_str() == Some("two/index.html"))
    );
    assert_eq!(calls.load(Ordering::Acquire), 2);
    assert_eq!(releases.load(Ordering::Acquire), 2);
    attempt.accept();
    let probe = store.begin(engine(), ReuseFence::new(&"settings"));
    probe.compare_prepared(&request, before, after).unwrap();
    assert_eq!((probe.work().reused, probe.work().compared), (2, 0));
}
